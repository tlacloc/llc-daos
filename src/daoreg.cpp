#include <daoreg.hpp>

ACTION daoreg::reset() {

  require_auth(get_self());

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.begin();
  while (daoit != _dao.end()) {
    daoit = _dao.erase(daoit);
  }
}

ACTION daoreg::create(const name& dao, const name& creator, const std::string& ipfs) {

  require_auth(creator);
  
  dao_table _dao(get_self(), get_self().value);
  auto dao_by_id = _dao.get_index<name("bydaodaoid")>();
  auto daoit = dao_by_id.lower_bound(uint128_t(dao.value) << 64);

  check(daoit == dao_by_id.end(), "dao with same name already registered");

  _dao.emplace(get_self(), [&](auto& new_org){
    uint64_t dao_id = _dao.available_primary_key();
    new_org.dao_id = dao_id;
    new_org.dao = dao;
    new_org.creator = creator;
    new_org.ipfs = ipfs;
  });

  if (is_account(dao)) {
    uint64_t ram_bytes = config_get_uint64(name("b.rambytes"));

    if (ram_bytes > 0) {
      action(
          permission_level(get_self(), name("active")),
          name("eosio"),
          name("buyrambytes"),
          std::make_tuple(get_self(), dao, uint32_t(ram_bytes))
      ).send();
    }

    asset del_amount_net = config_get_asset(name("d.net"));
    asset del_amount_cpu = config_get_asset(name("d.cpu"));

    if (del_amount_net.amount > 0 || del_amount_cpu.amount > 0) {
      action(
          permission_level(get_self(), name("active")),
          name("eosio"),
          name("delegatebw"),
          std::make_tuple(get_self(), dao, del_amount_net, del_amount_cpu, true)
      ).send();
    }
  }
}

ACTION daoreg::update(const uint64_t& dao_id, const std::string& ipfs) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find( dao_id );
  check( daoit != _dao.end(), "Organization not found" );

  require_auth( daoit->creator );

  _dao.modify(daoit, _self, [&](auto& org){
    org.ipfs = ipfs;
  });
}

ACTION daoreg::delorg(const uint64_t& dao_id) {

  require_auth(get_self());

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find( dao_id );
  check( daoit != _dao.end(), "Organization not found" );

  _dao.erase(daoit);
}

ACTION daoreg::setparam(name key, VariantValue value, string description)
{
  auto citr = config.find(key.value);
  if (citr == config.end()) {
    config.emplace(_self, [&](auto & item){
      item.key = key;
      item.value = value;
      if (description.length() > 0) {
        item.description = description;
      }
    });
  } else {
    config.modify(citr, _self, [&](auto & item){
      item.value = value;
      if (description.length() > 0) {
        item.description = description;
      }
    });
  }
}

ACTION daoreg::resetsttngs() {
  require_auth(get_self());
  
  auto citr = config.begin();
  while (citr != config.end()) {
    citr = config.erase(citr);
  }
}

ACTION daoreg::upsertattrs(const uint64_t &dao_id, std::vector<std::pair<std::string, VariantValue>> attributes) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find(dao_id);
  check(daoit != _dao.end(), "Organization not found");

  require_auth(daoit->creator);
  auto dao_attributes = daoit->attributes;

  for (auto &itr : attributes) {

    auto key = itr.first;
    auto attit = dao_attributes.find(key);

    if (attit != dao_attributes.end()) {
      _dao.modify(daoit, get_self(), [&](auto& dao){
        dao.attributes.at(itr.first) = itr.second;
      });
    } else {
      _dao.modify(daoit, get_self(), [&](auto& dao){
        dao.attributes.insert(std::make_pair(itr.first, itr.second));
      });
    }
  }
}

ACTION daoreg::delattrs(const uint64_t &dao_id, std::vector<std::string> attributes) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find(dao_id);
  check(daoit != _dao.end(), "Organization not found");

  require_auth(daoit->creator);

  for (auto const& itr : attributes) {
    _dao.modify(daoit, get_self(), [&](auto& dao){
      auto attit = dao.attributes.find(itr);
      if(attit != dao.attributes.end()){
        dao.attributes.erase(attit);
      }
    });
  }
}

ACTION daoreg::addtoken(const uint64_t &dao_id, const name &token_contract, const symbol &token) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find(dao_id);
  check(daoit != _dao.end(), "Organization not found");

  require_auth(daoit->creator);
  auto tokens = daoit->tokens;

  bool registr_exists = false;

  for (auto& itr : tokens) {       

    if(itr.first == token_contract && itr.second == token)
      registr_exists = true;
  }

  check(!registr_exists, "This token symbol is already added");

  _dao.modify(daoit, get_self(), [&](auto& dao){
    dao.tokens.push_back(std::pair(token_contract, token));
  });
}

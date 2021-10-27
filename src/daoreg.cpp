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
  _dao.emplace(get_self(), [&](auto& new_org){
    uint64_t dao_id = _dao.available_primary_key();
    dao_id = dao_id > 0 ? dao_id : 1;
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

void daoreg::deposit(const name& from, const name& to, const asset& quantity, const std::string& memo) {
  check(false, "");
  check(from != get_self() && to == get_self(), "Contract can not send to itself");
  check(quantity.amount > 0, "quantity has to be more than 0");

  check(!memo.empty(), "Memo can not be empty, especify dao_id");

  int64_t dao_id;
  name token_account;
  bool token_is_registered = false;

  dao_id = stoi(memo);
  check(dao_id >= 0, "Dao id has to be a positive number");
  symbol token_symbol = quantity.symbol;

  dao_table _dao(get_self(), get_self().value);

  if(dao_id == 0) {

    for (auto& itr : system_tokens) {
      if (itr.first == get_first_receiver() && itr.second == token_symbol) {
        token_is_registered = true;
        token_account = itr.first;
        break;
      }             
    }
    check(!token_is_registered, "This is not a supported system token");
  } else {
    auto daoit = _dao.find(dao_id);
    check(daoit != _dao.end(), "Organization not found");
    auto dao_tokens = daoit->tokens;

    for (auto& itr : dao_tokens) {
      if (itr.first == get_first_receiver() && itr.second == token_symbol) {
        token_is_registered = true;
        token_account = itr.first;
        break;
      }
    }
    check(!token_is_registered, "Token is not supported by a registred Dao");
  }

  balances_table _balances(get_self(), from.value);

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  if (itr == balances_by_token_account_token.end()) {
    _balances.emplace(get_self(), [&](auto& user){
      user.available = quantity;
      user.locked = asset(0, token_symbol);
      user.dao_id = dao_id;
      user.token_account = token_account;
    });
  } else {
    balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
      user.available += quantity;
    });
  }
}

ACTION daoreg::withdraw(const name &account, const name &token_account, const asset &quantity) {
  require_auth(account);
  check(quantity.amount > 0, "amount to withdraw must be positive quantity");

  balances_table _balances(get_self(), account.value);
  symbol token_symbol = quantity.symbol;

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(itr != balances_by_token_account_token.end(), "token account and symbol are not registered in your account");
  check(itr->available >= quantity, "you do not have enough balance");

  balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
    user.available -= quantity;
  });

  action(
      permission_level(get_self(), name("active")),
      name("eosio.token"),
      token_account,
      std::make_tuple(get_self(), account, quantity, "withdraw from `${get_self()}`")
  ).send();
}




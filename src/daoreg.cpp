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
    new_org.dao = dao;
    new_org.creator = creator;
    new_org.ipfs = ipfs;
  });

  uint64_t ram_bytes = config_get_uint64(name("b.rambytes"));

  action (
         permission_level( get_self(), name("active") ),
         name("eosio"), 
         name("buyrambytes"),
         std::make_tuple(get_self(), dao, uint32_t(ram_bytes))
  ).send();

  asset del_amount_net = config_get_asset(name("d.net"));
  asset del_amount_cpu = config_get_asset(name("d.cpu"));

  if(del_amount_net.amount > 0 && del_amount_cpu > 0) {
    action(
          permission_level(get_self(), name("active")),
          name("eosio"),
          name("delegatebw"),
          std::make_tuple(get_self(), dao, del_amount_net, del_amount_cpu, true)
    ).send();
  }
}

ACTION daoreg::update(const name& dao, const std::string& ipfs) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find( dao.value );
  check( daoit != _dao.end(), "Organization not found" );

  require_auth( daoit->creator );

  _dao.modify(daoit, _self, [&](auto& org){
    org.ipfs = ipfs;
  });

}

ACTION daoreg::delorg(const name& dao) {

  require_auth(get_self());

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find( dao.value );
  check( daoit != _dao.end(), "Organization not found" );

  _dao.erase(daoit);

}

ACTION daoreg::setparam(name key, SettingsValues value, string description)
{
  auto citr = config.find(key.value);
  if (citr == config.end())
  {
    config.emplace(_self, [&](auto & item){
      item.key = key;
      item.value = value;
      if (description.length() > 0)
      {
        item.description = description;
      }
    });
  }
  else
  {
    config.modify(citr, _self, [&](auto & item){
      item.value = value;
      if (description.length() > 0)
      {
        item.description = description;
      }
    });
  }
}

ACTION daoreg::resetsttngs()
{

  require_auth(get_self());
  
  auto citr = config.begin();
  while (citr != config.end())
  {
    citr = config.erase(citr);
  }
}
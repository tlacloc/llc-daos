#include <daoreg.hpp>

ACTION daoreg::reset() {
  require_auth(get_self());

  // user_tables users_t(get_self(), get_self().value);
  // auto uitr = users_t.begin();
  // while(uitr != users_t.end())
  // {
  //   uitr = users_t.erase(uitr);
  // }

}

// nombre de la organizacion, cuenta que la creo y hash de ipfs

ACTION daoreg::create(const name& org_name, const name& creator, const std::string& ipfs) {
  // check auth permitions 
  // require_auth( owner );
  // store in owner scope ?
  // check valid org_name ?
  // check valid ipfs ?

  organizations_table _organizations(get_self(), get_self().value);
  _organizations.emplace(get_self(), [&](auto& new_org){
    new_org.org_id = new_org.available_primary_key();
    new_org.org_name = org_name;
    new_org.creator = creator;
    new_org.ipfs = ipfs;
  });

}

ACTION daoreg::update(const uint64_t& org_id, const name& org_name, const name& creator, const std::string& ipfs) {

  // same validations as in create

  organizations_table _organizations(get_self(), get_self().value);

  auto orgit = _organizations.find( org_id );
  check( orgit != _organizations.end(), "Organization not found" );

  _organizations.modify(orgit, _self, [&](auto& org){
    org.org_name = org_name;
    org.creator = creator;
    org.ipfs = ipfs;
  });

}

ACTION daoreg::delorg(const uint64_t& org_id, const name& creator) {

}
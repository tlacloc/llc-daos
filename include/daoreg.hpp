#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <contracts.hpp>
#include <tables/users.hpp>
#include <config.hpp>
#include <util.hpp>
#include <common.hpp>

using namespace eosio;

CONTRACT daoreg : public contract {

  public:
    using contract::contract;
    daoreg(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds),
        config(receiver, receiver.value)
        {}

    ACTION reset();

    ACTION create(const name& org_name, const name& creator, const std::string& ipfs); 

    ACTION update(const uint64_t& org_id, const name& org_name, const name& creator, const std::string& ipfs);

    ACTION delorg(const uint64_t& org_id, const name& creator);

  private:

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    config_tables config;

    TABLE organizations {
      uint64_t org_id;
      std::string org_name;
      name creator;
      std::string ipfs

      auto primary_key () const { return org_id; }
    };

    typedef multi_index<name("org_table"), organizations> organizations_table;

};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  switch (action) {
      EOSIO_DISPATCH_HELPER(daoreg,
      (reset)
    )
  }
}

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

    ACTION create(const name& dao, const name& creator, const std::string& ipfs); 

    ACTION update(const name& dao, const std::string& ipfs);

    ACTION delorg(const name& dao);

  private:

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    config_tables config;

    TABLE daos {
      name dao;
      name creator;
      std::string ipfs;

      auto primary_key () const { return dao.value; }
      uint128_t by_creator_dao () const { return (uint128_t(creator.value) << 64)  + dao.value; }
    };

    typedef multi_index<name("daos"), daos, 
      indexed_by<name("bycreatordao"),
      const_mem_fun<daos, uint128_t, &daos::by_creator_dao>> 
    >dao_table;

};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  switch (action) {
      EOSIO_DISPATCH_HELPER(daoreg,
      (reset)(create)(update)(delorg)
    )
  }
}

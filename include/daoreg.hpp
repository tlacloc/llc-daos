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

  private:

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    config_tables config;

};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  switch (action) {
    EOSIO_DISPATCH_HELPER(daoreg,
      (reset)
    )
  }
}

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

    ACTION reset(std::vector<name> users);

    ACTION create(const name& dao, const name& creator, const std::string& ipfs);

    ACTION update(const uint64_t &dao_id, const std::string &ipfs);

    ACTION delorg(const uint64_t &dao_id);

    ACTION setparam(name key, VariantValue value, string description); 

    ACTION resetsttngs();

    ACTION upsertattrs(const uint64_t& dao_id, std::vector<std::pair<std::string, VariantValue>> attributes);

    ACTION delattrs(const uint64_t& dao_id, std::vector<std::string> attributes);

    ACTION addtoken(const uint64_t& dao_id, const name &token_contract, const symbol &token);

    [[eosio::on_notify("*::transfer")]] 
    void deposit(const name& from, const name& to, const asset& quantity, const std::string& memo);
        
    ACTION withdraw(const name &account, const name &dao, const asset &quantity);

  private:

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    config_tables config;

    typedef std::variant<std::monostate, uint64_t, int64_t, double, name, asset, string> VariantValue;

    std::vector<std::pair<name, symbol>> system_tokens = {{name("eosio.token"), symbol("TLOS", 4)}};

    TABLE daos {
      uint64_t dao_id;
      name dao;
      name creator;
      std::string ipfs;
      std::map<std::string, VariantValue> attributes;
      std::vector<std::pair<name, symbol>> tokens;

      auto primary_key () const { return dao_id; }
      uint128_t by_creator_dao () const { return (uint128_t(creator.value) << 64)  + dao.value; }
    };

    typedef multi_index<name("daos"), daos, 
      indexed_by<name("bycreatordao"),
      const_mem_fun<daos, uint128_t, &daos::by_creator_dao>> 
    >dao_table;

    TABLE balances {
      uint64_t id;
      asset available;
      asset locked; 
      uint64_t dao_id;
      name token_account;

      uint64_t primary_key () const { return id; }
      uint128_t by_token_account_token () const { return (uint128_t(token_account.value) << 64) + available.symbol.raw(); }
    };

    typedef multi_index<name("balances"), balances,
      indexed_by<name("bytkaccttokn"),
      const_mem_fun<balances, uint128_t, &balances::by_token_account_token>>
    >balances_table;
};



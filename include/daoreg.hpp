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

    ACTION create(
      const name & dao, 
      const name & creator, 
      const std::string & ipfs);

    ACTION update(
      const uint64_t & dao_id, 
      const std::string & ipfs);

    ACTION delorg(
      const uint64_t & dao_id);

    ACTION setparam(
      name key, 
      VariantValue value, 
      string description); 

    ACTION resetsttngs();

    ACTION upsertattrs(
      const uint64_t & dao_id, 
      std::vector<std::pair<std::string, VariantValue>> attributes);

    ACTION delattrs(
      const uint64_t & dao_id, 
      std::vector<std::string> attributes);

    ACTION addtoken(
      const uint64_t & dao_id, 
      const name & token_contract, 
      const symbol & token);

    [[eosio::on_notify("*::transfer")]] 
    void deposit(
      const name & from, 
      const name & to, 
      const asset & quantity, 
      const std::string & memo);
        
    ACTION withdraw(
      const name & account, 
      const name & dao, 
      const asset & quantity);

    ACTION createoffer (
      const uint64_t & dao_id, 
      const name & creator, 
      const asset & quantity, 
      const asset & price_per_unit, 
      const uint8_t & type);

    ACTION removeoffer (
      const uint64_t & dao_id, 
      const uint64_t & offer_id);

    ACTION acceptoffer (
      const uint64_t & dao_id, 
      const name & account,
      const uint64_t & offer_id);

  private:

    DEFINE_CONFIG_TABLE
    DEFINE_CONFIG_GET

    DEFINE_USERS_TABLE

    config_tables config;

    typedef std::variant<std::monostate, uint64_t, int64_t, double, name, asset, string> VariantValue;

    std::vector<std::pair<name, symbol>> system_tokens = {{name("eosio.token"), symbol("TLOS", 4)}};

    void token_exists(
      const uint64_t & dao_id, 
      const asset & quantity);

    void has_enough_balance(
      const uint64_t & dao_id, 
      const name & account, 
      const asset & quantity);

    void transfer(
      const name & from, 
      const name & to, 
      const asset & quantity, 
      const uint64_t & dao_id);

    void createbuyoffer ( 
      const uint64_t & dao_id, 
      const name & creator, 
      const asset & quantity, 
      const asset & price_per_unit,
      const uint8_t & token_id);

    void createselloffer ( 
      const uint64_t & dao_id, 
      const name & creator, 
      const asset & quantity, 
      const asset & price_per_unit,
      const uint8_t & token_id);

    void storeoffer ( 
      const uint64_t & dao_id, 
      const name & creator, 
      const asset & quantity, 
      const asset & price_per_unit,
      const uint8_t & token_id,
      const uint8_t & type);

    name get_token_account(
      const uint64_t & dao_id, 
      const symbol & token_symbol);

    TABLE daos {
      uint64_t dao_id;
      name dao;
      name creator;
      std::string ipfs;
      std::map<std::string, VariantValue> attributes;
      std::vector<std::pair<name, symbol>> tokens;

      auto primary_key () const { return dao_id; }
      uint128_t by_creator_dao () const { return (uint128_t(creator.value) << 64)  + dao.value; }
      uint128_t by_dao_daoid () const { return (uint128_t(dao.value) << 64)  + dao_id; }
    };

    typedef multi_index<name("daos"), daos, 
      indexed_by<name("bycreatordao"),
      const_mem_fun<daos, uint128_t, &daos::by_creator_dao>>,
      indexed_by<name("bydaodaoid"),
      const_mem_fun<daos, uint128_t, &daos::by_dao_daoid>>
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

    TABLE tokens { // scoped by dao_id
      uint8_t token_id;
      name token_account;
      symbol token_symbol;

      uint8_t primary_key () const { return token_id; }
      uint64_t by_token_account () const { return uint64_t(token_account.value);  }
      uint64_t by_token_symbol () const { return token_symbol.raw(); }
    };

    typedef multi_index<name("tokens"), tokens,
      indexed_by<name("bytknaccount"),
      const_mem_fun<tokens, uint64_t, &tokens::by_token_account>>,
      indexed_by<name("bytknsymbol"),
      const_mem_fun<tokens, uint64_t, &tokens::by_token_symbol>>
    >tokens_table;

    TABLE offers {  // scoped by dao_id
      uint64_t offer_id;
      name creator;
      asset available_quantity;
      asset total_quantity;
      asset price_per_unit; // always in TLOS
      std::map<string, asset> convertion_info; //(price_per_unit in USD, convertion_rate)
      uint8_t status;
      time_point timestamp;
      uint8_t type;
      uint8_t token_idx;
      uint128_t match_id;
      
      uint64_t primary_key () const { return offer_id; }

      uint128_t by_offer_match () const {
         return
            (uint128_t(type) << 64) + (uint128_t(status));
             // + (uint128_t(price_per_unit.amount) << 64 ) 
             //+ (uint128_t(token_idx) << 53 )
             // + (uint128_t(0xFFFFFFFFFFFFFF) & (uint128_t(std::numeric_limits<uint64_t>::max() - timestamp.sec_since_epoch()))  
            }  
    };

    typedef multi_index<name("offers"), offers,
      indexed_by<name("byoffermatch"),
      const_mem_fun<offers, uint128_t, &offers::by_offer_match>>
    >offers_table;




};



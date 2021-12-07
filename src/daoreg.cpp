#include <daoreg.hpp>

ACTION daoreg::reset(std::vector<name> users) {

  require_auth(get_self());

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.begin();
  while (daoit != _dao.end()) {
    daoit = _dao.erase(daoit);
  }

  for (auto const& itr : users) {
    balances_table _balances(get_self(), itr.value);
    auto it = _balances.begin();
    while(it != _balances.end()){
      it = _balances.erase(it);
    }
  }
}

ACTION daoreg::create(const name& dao, const name& creator, const std::string& ipfs) {

  require_auth( is_account(dao) ? dao : creator );
  
  dao_table _dao(get_self(), get_self().value);
  auto dao_by_id = _dao.get_index<name("bydaodaoid")>();
  auto daoit = dao_by_id.lower_bound(uint128_t(dao.value) << 64);

  check(daoit == dao_by_id.end(), "dao with the same name already exists");

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

ACTION daoreg::addtoken(const uint64_t &dao_id, const name &token_contract, const symbol &token_symbol) {

  dao_table _dao(get_self(), get_self().value);

  auto daoit = _dao.find(dao_id);
  check(daoit != _dao.end(), "Organization not found");

  require_auth(daoit->creator);
  auto tokens = daoit->tokens;

  bool registr_exists = false;

  for (auto& itr : tokens) {       

    if(itr.first == token_contract && itr.second == token_symbol)
      registr_exists = true;
  }

  check(!registr_exists, "This token symbol is already added");

  _dao.modify(daoit, get_self(), [&](auto& dao){
    dao.tokens.push_back(std::pair(token_contract, token_symbol));
  });

  tokens_table token_t(get_self(), dao_id);

  token_t.emplace(get_self(), [&](auto& item){

    uint8_t token_id = token_t.available_primary_key();
    token_id = token_id > 0 ? token_id : 1;
    item.token_id = token_id;
    item.token_account = token_contract;
    item.token_symbol = token_symbol; 

  });

}

void daoreg::deposit(const name& from, const name& to, const asset& quantity, const std::string& memo) {

  if(to == get_self()) {
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
      check(token_is_registered, "This is not a supported system token");
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
      check(token_is_registered, "Token is not supported by a registred Dao");
    }

    balances_table _balances(get_self(), from.value);

    auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
    auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

    if (itr == balances_by_token_account_token.end()) {
      _balances.emplace(get_self(), [&](auto& user){
        user.id = _balances.available_primary_key();
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
}

ACTION daoreg::withdraw ( const name &account, const name &token_account, const asset &quantity ) {
  check(quantity.amount > 0, "Amount to withdraw has to be higher than zero");
  require_auth(account);

  balances_table _balances(get_self(), account.value);
  symbol token_symbol = quantity.symbol;

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(itr != balances_by_token_account_token.end(), "Token account and symbol are not registered in your account");
  check(itr->available >= quantity, "You do not have enough balance");

  balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
    user.available -= quantity;
  });

  action(
      permission_level{get_self(), name("active")},
      token_account,
      "transfer"_n,
      std::make_tuple(get_self(), account, quantity, string("withdraw from here"))
  ).send();

}

ACTION daoreg::createoffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity, 
  const asset & price_per_unit, 
  const uint8_t & type) {

  require_auth(creator);

  symbol token_symbol = quantity.symbol;

  tokens_table token_t(get_self(), dao_id);

  auto token_by_symbol = token_t.get_index<name("bytknsymbol")>();
  auto sitr = token_by_symbol.find(token_symbol.raw());

  check(sitr != token_by_symbol.end(), "Token not found");

  // has_enough_balance(dao_id, creator, quantity);

  if ( type == util::type_sell_offer) {

    createselloffer(dao_id, creator, quantity, price_per_unit, sitr->token_id);

  } else if ( type == util::type_buy_offer) {

    createbuyoffer(dao_id, creator, quantity, price_per_unit, sitr->token_id);

  }

}

void daoreg::createbuyoffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity, 
  const asset & price_per_unit,
  const uint8_t & token_id) {

  offers_table offer_t(get_self(), get_self().value);

  auto by_offer_match = offer_t.get_index<eosio::name("byoffermatch")>();

  // offer match
  auto soitr_buy = by_offer_match.lower_bound( (uint128_t(util::type_sell_offer) << 125) +  
    (uint128_t(util::status_active) << 123)  + (uint128_t(price_per_unit.amount) << 64 )  + (uint128_t(token_id) << 53)  ) ;

  if (soitr_buy == by_offer_match.end()) {

    offers_table offer_t(get_self(), dao_id);

    offer_t.emplace(get_self(), [&](auto & item){
      item.offer_id = offer_t.available_primary_key();
      item.creator = creator;
      item.available_quantity = quantity;
      item.total_quantity = quantity;
      item.price_per_unit = price_per_unit; // always in TLOS  tlostoken
      item.status = util::status_active;
      item.timestamp = current_time_point();
      item.type = util::type_buy_offer;
      item.token_idx = token_id;
      item.match_id = (uint128_t(util::type_buy_offer) << 125) + (uint128_t(util::status_active) << 123) 
                      + (uint128_t(price_per_unit.amount) << 64 ) 
                      + (uint128_t(0xFFFFFFFFFFFFFF) &  (uint128_t(std::numeric_limits<uint64_t>::max() - current_time_point().sec_since_epoch()) ));
    });
  } else {
    print("offer found!");
  }
}

void daoreg::createselloffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity, 
  const asset & price_per_unit,
  const uint8_t & token_id) {

  offers_table offer_t(get_self(), get_self().value);

  auto by_offer_match = offer_t.get_index<eosio::name("byoffermatch")>();

  // offer match
  auto boitr_sell = by_offer_match.lower_bound( (uint128_t(util::type_buy_offer) << 125) +  
    (uint128_t(util::status_active) << 123)  + (uint128_t(price_per_unit.amount) << 64 )  + (uint128_t(token_id) << 53) ) ;

  if (boitr_sell == by_offer_match.end()) {

    offers_table offer_t(get_self(), dao_id);

    offer_t.emplace(get_self(), [&](auto & item){
      item.offer_id = offer_t.available_primary_key();
      item.creator = creator;
      item.available_quantity = quantity;
      item.total_quantity = quantity;
      item.price_per_unit = price_per_unit; // always in TLOS  tlostoken
      item.status = util::status_active;
      item.timestamp = current_time_point();
      item.type = util::type_sell_offer;
      item.token_idx = token_id;
      item.match_id = (uint128_t(util::type_sell_offer) << 125) + (uint128_t(util::status_active) << 123) 
                      + (uint128_t(price_per_unit.amount) << 64 ) 
                      + (uint128_t(0xFFFFFFFFFFFFFF) &  (uint128_t(std::numeric_limits<uint64_t>::max() - current_time_point().sec_since_epoch()) ));
    });

  } else {
    print("offer found!");
  }
  
}


ACTION daoreg::removeoffer (const uint64_t & dao_id, const uint64_t & offer_id) {
  
  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "Offer not found");

  require_auth(ofit->creator);

  offer_t.erase(ofit);

}


ACTION daoreg::acceptoffer (const uint64_t & dao_id, const name & account, const uint64_t & offer_id) {

  require_auth(account);

  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "Offer not found");

  check(ofit->status == util::status_active, "Offer is not active");


  asset cost = asset(ofit->available_quantity.amount * ofit->price_per_unit.amount, ofit->price_per_unit.symbol);
  has_enough_balance(dao_id, account, cost);

  if (ofit->type == util::type_sell_offer) {
    transfer(account, ofit->creator, cost, dao_id);
    transfer(ofit->creator, account, ofit->available_quantity, dao_id);

  } else if (ofit->type == util::type_buy_offer) {
    transfer(ofit->creator, account, cost, dao_id);
    transfer(account, ofit->creator, ofit->available_quantity, dao_id);
  } 

  offer_t.modify(ofit, get_self(), [&](auto& item){
    item.available_quantity = asset(0, ofit-> available_quantity.symbol);
    item.status = util::status_closed;
  });

}

void daoreg::transfer(const name & from, const name & to, const asset & quantity, const uint64_t & dao_id) {

  check(quantity.amount > 0, "Amount to transfer has to be higher than zero");
  require_auth(from);

  token_exists(dao_id, quantity);
  name token_account = get_token_account(dao_id, quantity.symbol);

  balances_table _balances(get_self(), from.value);
  symbol token_symbol = quantity.symbol;

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(itr != balances_by_token_account_token.end(), "Token account and symbol are not registered in your account");
  check(itr->available >= quantity, "You do not have enough balance");

  balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
    user.available -= quantity;
  });


  balances_table _balancesTo(get_self(), to.value);

  auto balances_by_token_account_tokenTo = _balancesTo.get_index<name("bytkaccttokn")>();
  auto bitr = balances_by_token_account_tokenTo.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(bitr != balances_by_token_account_tokenTo.end(), "Token account and symbol are not registered in your account");
  check(bitr->available >= quantity, "You do not have enough balance");

  balances_by_token_account_tokenTo.modify(bitr, get_self(), [&](auto& user){
    user.available += quantity;
  });

}

void daoreg::token_exists(const uint64_t & dao_id, const asset & quantity) {

  symbol token_symbol = quantity.symbol;

  bool token_is_registered = false;

  dao_table _dao(get_self(), get_self().value);

  if(dao_id == 0) {

      for (auto& itr : system_tokens) {
        if (itr.second == token_symbol) { // check
          token_is_registered = true;
          break;
        }             
      }
      check(token_is_registered, "This is not a supported system token");
    } else {
      auto daoit = _dao.find(dao_id);
      check(daoit != _dao.end(), "Organization not found");
      auto dao_tokens = daoit->tokens;

      for (auto& itr : dao_tokens) {
        if (itr.second == token_symbol) {
          token_is_registered = true;
          break;
        }
      }
      check(token_is_registered, "Token is not supported by a registred Dao");
    }
}

void daoreg::has_enough_balance(const uint64_t & dao_id, const name & account, const asset & quantity) {
  
  token_exists(dao_id, quantity);
  name token_account = get_token_account(dao_id, quantity.symbol);

  balances_table _balances(get_self(), account.value);
  symbol token_symbol = quantity.symbol;

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(itr != balances_by_token_account_token.end(), "Token account and symbol are not registered in your account");
  check(itr->available >= quantity, "You do not have enough balance");

}

name daoreg::get_token_account(const uint64_t & dao_id, const symbol & token_symbol) {

  name token_account;
  bool token_is_registered = false;

  check(dao_id >= 0, "Dao id has to be a positive number");

  dao_table _dao(get_self(), get_self().value);

  if(dao_id == 0) {

    for (auto& itr : system_tokens) {
      if (itr.second == token_symbol) {
        token_is_registered = true;
        token_account = itr.first;
        break;
      }             
    }
    check(token_is_registered, "This is not a supported system token");

  } else {

    auto daoit = _dao.find(dao_id);
    check(daoit != _dao.end(), "Organization not found");
    auto dao_tokens = daoit->tokens;

    for (auto& itr : dao_tokens) {
      if (itr.second == token_symbol) {
        token_is_registered = true;
        token_account = itr.first;
        break;
      }
    }
    check(token_is_registered, "Token is not supported by a registred Dao");
  }

  return token_account;

}
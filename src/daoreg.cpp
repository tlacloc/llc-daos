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

ACTION daoreg::resetoffers() {
  // offers_table _offer(get(), dao_id);
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

    if ( del_amount_net.amount > 0 || del_amount_cpu.amount > 0 ) {
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

// not a calleable action
void daoreg::deposit(const name& from, const name& to, const asset& quantity, const std::string& memo) {

  if(to == get_self()) {
    check(!memo.empty(), "deposit: Memo can not be empty, especify dao_id");

    int64_t dao_id;
    name token_account;
    bool token_is_registered = false;

    dao_id = stoi(memo);
    check(dao_id >= 0, "deposit: Dao id has to be a positive number");
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
      check(token_is_registered, "deposit: This is not a supported system token");
    } else {
      auto daoit = _dao.find(dao_id);
      check(daoit != _dao.end(), "deposit: Organization not found");
      auto dao_tokens = daoit->tokens;

      for (auto& itr : dao_tokens) {
        if (itr.first == get_first_receiver() && itr.second == token_symbol) {
          token_is_registered = true;
          token_account = itr.first;
          break;
        }
      }
      check(token_is_registered, "deposit: Token is not supported by a registred Dao");
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

  check(sitr != token_by_symbol.end(), "createoffer: Token not found");

  // has_enough_balance(dao_id, creator, quantity); // balances table daoreg
  // sell_offer -> type = 0, buy_offer -> type = 1

  if ( type == util::type_sell_offer) {

    createselloffer(dao_id, creator, quantity, price_per_unit, sitr->token_id);

  } else if ( type == util::type_buy_offer) {

    createbuyoffer(dao_id, creator, quantity, price_per_unit, sitr->token_id);

  }

}

void daoreg::storeoffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity,
  const asset & price_per_unit,
  const uint8_t & token_id,
  const uint8_t & status,
  const uint8_t & type) {

  offers_table offer_t(get_self(), dao_id);

  const eosio::asset new_quantity = (status == util::status_closed) ? asset(0, quantity.symbol) : quantity;

  offer_t.emplace(get_self(), [&](auto & item){
    item.offer_id = offer_t.available_primary_key();
    item.creator = creator;
    item.available_quantity = new_quantity;
    item.total_quantity = quantity;
    item.price_per_unit = price_per_unit; // always in TLOS  tlostoken
    item.status = status;
    item.creation_date = current_time_point();
    item.type = type;
    item.token_idx = token_id;
    item.match_id = (uint128_t(0xF                  & type)                   << 124) 
                    + (uint128_t(0xF                & util::status_active)    << 122)
                    + (uint128_t(0xF                & token_id)               << 120)
                    + (uint128_t(0xFFFFFFFFFFFFFFFF & price_per_unit.amount)  << 56 ) 
                    + (uint128_t(0xFFFFFFFFFFFFFF   &  std::numeric_limits<uint64_t>::max() - current_time_point().sec_since_epoch()));
  });
	// const uint8_t type_sell_offer = 0 -> locked: DTK
	// const uint8_t type_buy_offer  = 1 -> locked: TLOS

  if (type == util::type_sell_offer) {
    name token_account = get_token_account( dao_id, quantity.symbol);

    balances_table _balances(get_self(), creator.value);
    auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
    auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + quantity.symbol.raw());
    
    balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
      user.available -= quantity;
      user.locked += quantity;
    });

  } 
  else if (type == util::type_buy_offer) {
    name system_token_account = get_token_account( dao_id, price_per_unit.symbol );
    
    balances_table _balances(get_self(), creator.value);
    auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
    auto itr = balances_by_token_account_token.find((uint128_t(system_token_account.value) << 64) + price_per_unit.symbol.raw());
    
    balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
      user.available -= asset(price_per_unit.amount * quantity.amount /10000, price_per_unit.symbol);;
      user.locked += asset(price_per_unit.amount * quantity.amount /10000, price_per_unit.symbol);
    });
  }

}

void daoreg::createbuyoffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity, 
  const asset & price_per_unit,
  const uint8_t & token_id) {

  // divided by 10000 to normalize system token
  asset cost = asset(quantity.amount * price_per_unit.amount / 10000, price_per_unit.symbol); 
  has_enough_balance(dao_id, creator, cost);

  offers_table offer_t(get_self(), dao_id);
  auto by_offer_match = offer_t.get_index<eosio::name("byoffermatch")>();

  // offer match
  auto soitr_buy = by_offer_match.lower_bound(
      ( uint128_t(0xF & util::type_sell_offer) << 124 ) 
     + ( uint128_t(0xF & util::status_active) << 122 )
     + ( uint128_t(0xF & token_id) << 120 )
     + ( uint128_t(0xFFFFFFFFFFFFFFFF & price_per_unit.amount ) << 56 )   
    );

  //check(soitr_buy -> type == util::type_sell_offer, "Both offers are of the same type");
  //check(soitr_buy -> status == util::status_closed, "Offer is not active");
  //check(soitr_buy -> token_idx)

  bool offer_match = meets_requirements( 
                      soitr_buy -> type, 
                      soitr_buy -> status, 
                      soitr_buy -> token_idx,
                      soitr_buy -> price_per_unit,
                      soitr_buy -> available_quantity,
                      util::type_buy_offer,
                      token_id, 
                      price_per_unit,
                      quantity);

  bool offer_not_exists = (soitr_buy == by_offer_match.end() || soitr_buy -> type != util::type_sell_offer);
  
  if (offer_not_exists) { 
    storeoffer(dao_id, creator, quantity, price_per_unit, token_id, util::status_active, util::type_buy_offer);
  
  } else {
    check(offer_match = true, "offer does not match");
    storeoffer(dao_id, creator,  quantity, price_per_unit, token_id, util::status_closed, util::type_buy_offer);
    action(
      permission_level{ creator, name("active") },
      _self,
      "acceptoffer"_n,
      std::make_tuple(dao_id, creator, soitr_buy->offer_id)
    ).send();
  }
}

void daoreg::createselloffer ( 
  const uint64_t & dao_id, 
  const name & creator, 
  const asset & quantity, 
  const asset & price_per_unit,
  const uint8_t & token_id) {

  has_enough_balance(dao_id, creator, quantity);

  offers_table offer_t(get_self(), dao_id);

  auto by_offer_match = offer_t.get_index<eosio::name("byoffermatch")>();

  // offer match

  auto boitr_sell = by_offer_match.lower_bound( 
      ( uint128_t(0xF & util::type_buy_offer) << 124 ) 
     + ( uint128_t(0xF & util::status_active) << 122 )
     + ( uint128_t(0xF & token_id) << 120 )
     + ( uint128_t(0xFFFFFFFFFFFFFFFF & price_per_unit.amount ) << 56 )  
    );
  const bool offer_not_exists = (boitr_sell == by_offer_match.end() || boitr_sell -> type != util::type_buy_offer);

  if (offer_not_exists) { 
    storeoffer(dao_id, creator, quantity, price_per_unit, token_id, util::status_active, util::type_sell_offer);

  } else {
    storeoffer(dao_id, creator, quantity, price_per_unit, token_id, util::status_closed, util::type_sell_offer);
    action(
      permission_level{ creator, name("active") },
      _self,
      "acceptoffer"_n,
      std::make_tuple(dao_id, creator, boitr_sell->offer_id)
    ).send();

  }
  
}


ACTION daoreg::removeoffer (const uint64_t & dao_id, const uint64_t & offer_id) {
  
  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "removeoffer: Offer not found");

  require_auth( has_auth(ofit->creator) ? ofit->creator : get_self() );

  offer_t.erase(ofit);

}


ACTION daoreg::acceptoffer (const uint64_t & dao_id, const name & account, const uint64_t & offer_id) {

  require_auth(account);

  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "acceptoffer:Offer not found");

  check(ofit->status == util::status_active, "Offer is not active");

  if (ofit->type == util::type_sell_offer) { 

    resolve_sell_offer(dao_id, offer_id, account);

  } else if (ofit->type == util::type_buy_offer) {

    resolve_buy_offer(dao_id, offer_id, account);

  } 
  

}

void daoreg::resolve_buy_offer(
  const uint64_t & dao_id,
  const uint8_t & offer_id,
  const name & seller ) {

  /*
    creator
    wants daos token
    has system token
  */

  require_auth(seller);

  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "resolve_buy_offer: Offer not found");

  check(ofit->status == util::status_active, "Offer is not active");

  // divided by 10000 to normalize system token

  asset cost = asset( ofit->available_quantity.amount * ofit->price_per_unit.amount / 10000, ofit->price_per_unit.symbol );  
  has_enough_balance(dao_id, seller, ofit->available_quantity);

  name daos_token_account = get_token_account( dao_id, ofit->available_quantity.symbol );
  name system_token_account = get_token_account( dao_id, ofit->price_per_unit.symbol );

  // transfer system tokens
  remove_balance( ofit->creator, cost, system_token_account, dao_id );
  add_balance( seller, cost, system_token_account, dao_id );


  // transfer daos tokens
  add_balance( ofit->creator, ofit->available_quantity, daos_token_account, dao_id );
  remove_balance(seller, ofit->available_quantity, daos_token_account, dao_id );

  offer_t.modify(ofit, get_self(), [&](auto& item){
    item.available_quantity = asset(0, ofit-> available_quantity.symbol);
    item.status = util::status_closed;
  });

}


void daoreg::resolve_sell_offer(
  const uint64_t & dao_id,
  const uint8_t & offer_id,
  const name & buyer) {

  /*
    creator
    wants system token
    has daos token
  */

  require_auth(buyer);

  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);
  check(ofit != offer_t.end(), "resolve_sell_offer: Offer not found");

  check(ofit->status == util::status_active, "Offer is not active");

  // pays in system token
  // divided by 10000 to normalize system token

  asset cost = asset( ofit->available_quantity.amount * ofit->price_per_unit.amount / 10000, ofit->price_per_unit.symbol );  
  has_enough_balance(dao_id, buyer, cost);

  name daos_token_account = get_token_account( dao_id, ofit->available_quantity.symbol );
  name system_token_account = get_token_account( dao_id, ofit->price_per_unit.symbol );

  // transfer system tokens
  add_balance( ofit->creator, cost, system_token_account, dao_id );
  remove_balance( buyer, cost, system_token_account, dao_id );


  // transfer daos tokens
  remove_balance( ofit->creator, ofit->available_quantity, daos_token_account, dao_id );
  add_balance( buyer, ofit->available_quantity, daos_token_account, dao_id );

  offer_t.modify(ofit, get_self(), [&](auto& item){
    item.available_quantity = asset(0, ofit-> available_quantity.symbol);
    item.status = util::status_closed;
  });


}

void daoreg::add_balance(
  const name & account, 
  const asset & quantity, 
  const name & token_account,
  const uint64_t & dao_id) {


  balances_table _balances(get_self(), account.value);

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + quantity.symbol.raw());

  if (itr == balances_by_token_account_token.end()) {
    _balances.emplace(get_self(), [&](auto& user){
      user.id = _balances.available_primary_key();
      user.available = quantity;
      user.locked = asset(0, quantity.symbol);
      user.dao_id = dao_id;
      user.token_account = token_account;
    });
  } else {
    balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
      user.available += quantity;
    });
  }

}


void daoreg::remove_balance(
  const name & account, 
  const asset & quantity, 
  const name & token_account,
  const uint64_t & dao_id) {

  balances_table _balances(get_self(), account.value);

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + quantity.symbol.raw());

  check(itr != balances_by_token_account_token.end(), "Token account and symbol are not registered in your account");
  check(itr->available >= quantity, "You do not have enough balance");

  balances_by_token_account_token.modify(itr, get_self(), [&](auto& user){
    user.locked -= quantity;
  });
}

void daoreg::send_transfer(
  const name & beneficiary, 
  const asset & quantity, 
  const std::string & memo, 
  const name & token_account) {

}

void daoreg::send_transfer(
  const name & sender,
  const name & beneficiary, 
  const asset & quantity, 
  const std::string & memo, 
  const name & token_account) {

  action(
    permission_level(get_self(), "active"_n),
    token_account,
    "transfer"_n,
    std::make_tuple( sender, beneficiary, quantity, memo )
  ).send();

}

void daoreg::close_offer(
  const uint64_t & dao_id,
  const uint8_t & offer_id) {

  offers_table offer_t(get_self(), dao_id);

  auto ofit = offer_t.find(offer_id);

  offer_t.modify(ofit, get_self(), [&](auto& item){
    item.status = util::status_closed;
  });

}



void daoreg::transfer(const name & from, const name & to, const asset & quantity, const uint64_t & dao_id) {

  check(quantity.amount > 0, "Amount to transfer has to be higher than zero");

  require_auth( has_auth(from) ? from : get_self() );

  /// token_exists(dao_id, quantity);
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

  tokens_table token_t(get_self(), dao_id);

  auto token_by_symbol = token_t.get_index<name("bytknsymbol")>();
  auto sitr = token_by_symbol.find(token_symbol.raw());

  check(sitr != token_by_symbol.end(), "token_exists: Token not found");

}

void daoreg::has_enough_balance(const uint64_t & dao_id, const name & account, const asset & quantity) {
  
  // token_exists(dao_id, quantity);
  name token_account = get_token_account(dao_id, quantity.symbol);

  balances_table _balances(get_self(), account.value);
  symbol token_symbol = quantity.symbol;

  auto balances_by_token_account_token = _balances.get_index<name("bytkaccttokn")>();
  auto itr = balances_by_token_account_token.find((uint128_t(token_account.value) << 64) + token_symbol.raw());

  check(itr != balances_by_token_account_token.end(), "has_enough_balance: Token account and symbol are not registered in your account");
  check(itr->available >= quantity, "has_enough_balance: You do not have enough balance");

}


name daoreg::get_token_account(const uint64_t & dao_id, const symbol & token_symbol) {

  // error when passing system tokens cuz are stored at dao_id = 0

  name token_account;
  bool token_is_registered = false;

  check(dao_id >= 0, "get_token_account: Dao id has to be a positive number");

  dao_table _dao(get_self(), get_self().value);

  // tokens registred in a dao
  auto daoit = _dao.find(dao_id);
  check(daoit != _dao.end(), "get_token_account: Organization not found");
  auto dao_tokens = daoit->tokens;

  for (auto& itr : dao_tokens) {
    if (itr.second == token_symbol) {
      token_is_registered = true;
      token_account = itr.first;
      break;
    }
  }

  // system token
  if (!token_is_registered) {
    for (auto& itr : system_tokens) {
      if (itr.second == token_symbol) {
        token_is_registered = true;
        token_account = itr.first;
        break;
      }             
    }
  }

  check(token_is_registered, "get_token_account: Token is not supported by a registred Dao");

  return token_account;

}

bool daoreg::meets_requirements(
  const uint8_t & type_offer,
  const uint8_t & status_offer,
  const uint8_t & token_idx_offer,
  const asset & price_per_unit_offer,
  const asset & available_quantity_offer,
  const uint8_t & type, 
  const uint8_t & token_id,
  const asset & price_per_unit,
  const asset & quantity){

    uint8_t type_in;
    if (type == util::type_buy_offer ) {
      type_in = util::type_sell_offer;
    }else if (type == util::type_sell_offer) {
      type_in = util::type_buy_offer;
    }

    if(status_offer == util::status_active) {
      if (token_idx_offer == token_id) {
        if (price_per_unit_offer == price_per_unit) {
          if (available_quantity_offer.amount > 0 ) {
            if (type_offer == type_in) {
              return true;
            }
          }

        }
      }
    } else {
      return false;
    }
  }
#pragma once

#include <eosio/name.hpp>
#include <eosio/asset.hpp>
#include <contracts.hpp>
#include <variant>

using namespace eosio;
using std::string;

namespace util
{
	// offers table
	const uint8_t type_sell_offer = 0;
	const uint8_t type_buy_offer = 1;


	const uint8_t status_active = 1;

}

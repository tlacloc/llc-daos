#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>

using namespace eosio;

namespace graph {

  // document type
  static constexpr name ROOT = name("root");
  static constexpr name DAOS_NODE = name("daosnode");
  static constexpr name DAO_INFO = name("daoinfo");

  // graph edges
  static constexpr name VARIABLE = name("variable");
  static constexpr name OWNS_DAO_INFO = name("owndaoinform");
  static constexpr name OWNED_BY = name("ownedby");
  static constexpr name HAS_DAOS = name("hasdaos");
  static constexpr name HAS_DAOS = name("daos");

  #define NOT_FOUND -1

  #define FIXED_DETAILS "fixed_details"
  #define VARIABLE_DETAILS "variable_details"
  #define IDENTIFIER_DETAILS "identifier_details"
  #define OWNER "owner"
  #define CREATOR "creator"
  #define TYPE "type"
  #define TITLE "title"
  #define NODE_HASH "node_hash"
}

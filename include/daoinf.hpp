#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>
#include <contracts.hpp>
#include <util.hpp>
#include <common.hpp>

#include <graph_common.hpp>
#include <document_graph/content.hpp>
#include <document_graph/document.hpp>
#include <document_graph/edge.hpp>
#include <document_graph/util.hpp>
#include <document_graph/content_wrapper.hpp>
#include <document_graph/document_graph.hpp>

using namespace eosio;
// using namespace utils;
using std::string;

typedef std::variant<asset, string, time_point, name, int64_t> ContentVariant;

CONTRACT daoinf : public contract {

  public:
    using contract::contract;
    daoinf(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds)
        {}
    
    DECLARE_DOCUMENT_GRAPH(daoinf)

    ACTION reset();

    ACTION initdao(const name & creator);

    ACTION storeentry(const std::vector<hypha::Content> & values);

    ACTION delentry(const string & label);

  private:

    int64_t active_cutoff_date();
    hypha::Document get_root_node();
    hypha::Document get_dao_node();
    hypha::Document get_doc_from_edge(const checksum256 & node_hash, const name & edge_name);
    void update_node(hypha::Document * node_doc, const string & content_group_label, const std::vector<hypha::Content> & new_contents);
    bool edge_exists(const checksum256 & from_node_hash, const name & edge_name);

    hypha::DocumentGraph m_documentGraph = hypha::DocumentGraph(get_self());
};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
  switch (action) {
    EOSIO_DISPATCH_HELPER(daoinf, (reset)
      (initdao)
      (storeentry)(delentry)
    )
  }
}

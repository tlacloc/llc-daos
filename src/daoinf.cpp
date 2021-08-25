#include <daoinf.hpp>

#include "document_graph/content.cpp"
#include "document_graph/document.cpp"
#include "document_graph/edge.cpp"
#include "document_graph/util.cpp"
#include "document_graph/content_wrapper.cpp"
#include "document_graph/document_graph.cpp"

ACTION daoinf::reset () {
  require_auth(get_self());

  document_table d_t(get_self(), get_self().value);
  auto ditr = d_t.begin();
  while (ditr != d_t.end()) {
    ditr = d_t.erase(ditr);
  }

  edge_table e_t(get_self(), get_self().value);
  auto eitr = e_t.begin();
  while (eitr != e_t.end()) {
    eitr = e_t.erase(eitr);
  }
}

ACTION daoinf::initdao() {
  require_auth(get_self());

    // create the root node
  hypha::ContentGroups root_cgs {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, FIXED_DETAILS),
      hypha::Content(TYPE, graph::ROOT),
      hypha::Content(OWNER, get_self())
    }
  };

  // create the dao node
  hypha::ContentGroups dao_info_cgs {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, FIXED_DETAILS),
      hypha::Content(TYPE, graph::DAO_INFO),
      hypha::Content(OWNER, get_self())
    }
  };

  hypha::Document root_doc(get_self(), get_self(), std::move(root_cgs));
  hypha::Document dao_info_doc(get_self(), get_self(), std::move(dao_info_cgs));

  hypha::Edge::write(get_self(), get_self(), root_doc.getHash(), dao_info_doc.getHash(), graph::OWNS_DAO_INFO);
  hypha::Edge::write(get_self(), get_self(), dao_info_doc.getHash(), root_doc.getHash(), graph::OWNED_BY);
}

// ACTION daoinf::updatecontent(const checksum256 & dao_hash, const std::vector<hypha::Content> & contents) {
//   hypha::Document dao_info_doc(get_self(), dao_hash);

//   name creator = dao_info_doc.getCreator();

//   require_auth(creator);
//   check_user(creator);

//   hypha::Document dao_info_v_doc = get_variable_node_or_fail(dao_info_doc);
//   hypha::ContentWrapper dao_info_v_cw = dao_info_v_doc.getContentWrapper();

//   update_node(&dao_info_v_doc, VARIABLE_DETAILS, contents);

// }
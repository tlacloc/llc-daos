#include <daoinf.hpp>

#include "document_graph/content.cpp"
#include "document_graph/document.cpp"
#include "document_graph/edge.cpp"
#include "document_graph/util.cpp"
#include "document_graph/content_wrapper.cpp"
#include "document_graph/document_graph.cpp"

ACTION daoinf::reset () {
  require_auth(get_self());

  Es q d_t(get_self(), get_self().value);
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
      hypha::Content(OWNER, get_self())
    }
  };

  hypha::ContentGroups dao_info_v_cgs {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, VARIABLE_DETAILS),
      hypha::Content(OWNER, get_self())
    }
  };

  hypha::Document root_doc(get_self(), get_self(), std::move(root_cgs));
  hypha::Document dao_info_doc(get_self(), get_self(), std::move(dao_info_cgs));
  hypha::Document dao_info_v_doc(get_self(), get_self(), std::move(dao_info_v_cgs));

  hypha::Edge::write(get_self(), get_self(), root_doc.getHash(), dao_info_doc.getHash(), graph::OWNS_DAO_INFO);
  hypha::Edge::write(get_self(), get_self(), dao_info_doc.getHash(), root_doc.getHash(), graph::OWNED_BY);
  hypha::Edge::write(get_self(), get_self(), dao_info_doc.getHash(), dao_info_v_doc.getHash(), graph::VARIABLE);
}

ACTION daoinf::addentry(const string & label, const hypha::Content & value) {
  require_auth(get_self());

  hypha::Document dao_doc = get_dao_node();

  update_node(&dao_doc, VARIABLE_DETAILS, {
    value
  });
}

ACTION daoinf::editentry(const string & label, const hypha::Content & value) {
  require_auth(get_self());

  hypha::Document dao_doc = get_dao_node();

  update_node(&dao_doc, VARIABLE_DETAILS, {
    value
  });
}

ACTION daoinf::delentry(const string & label, const hypha::Content & value) {
  require_auth(get_self());

  hypha::Document dao_doc = get_dao_node();
  hypha::ContentWrapper dao_cw = dao_doc.getContentWrapper();

  hypha::Content cont_to_del = dao_cw.getOrFail(VARIABLE_DETAILS, label, string("Content not found"));

  hypha::ContentWrapper.removeContent(VARIABLE_DETAILS, cont_to_del);
}

// Helpers

void daoinf::update_node (hypha::Document * node_doc, const string & content_group_label, const std::vector<hypha::Content> & new_contents) {
  checksum256 old_node_hash = node_doc -> getHash();

  hypha::ContentWrapper node_cw = node_doc -> getContentWrapper();
  hypha::ContentGroup * node_cg = node_cw.getGroupOrFail(content_group_label);

  for (int i = 0; i < new_contents.size(); i++) {
    hypha::ContentWrapper::insertOrReplace(*node_cg, new_contents[i]);
  }

  m_documentGraph.updateDocument(get_self(), old_node_hash, node_doc -> getContentGroups());
}

hypha::Document daoinf::get_dao_node () {
  hypha::Document root_doc = get_root_node();
  return get_doc_from_edge(root_doc.getHash(), graph::OWNS_DAO_INFO);
}

hypha::Document daoinf::get_root_node () {
  document_table d_t(get_self(), get_self().value);
  auto root_itr = d_t.begin();

  check(root_itr != d_t.end(), "There is no root node");

  hypha::Document root_doc(get_self(), root_itr -> getHash());
  return root_doc;
}
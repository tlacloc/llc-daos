#include <daoinf.hpp>

#include "document_graph/content.cpp"
#include "document_graph/document.cpp"
#include "document_graph/edge.cpp"
#include "document_graph/util.cpp"
#include "document_graph/content_wrapper.cpp"
#include "document_graph/document_graph.cpp"

ACTION daoinf::reset () {
  require_auth(get_self());

  document_table d_t(_self, _self.value);
  auto ditr = d_t.begin();
  while (ditr != d_t.end()) {
    ditr = d_t.erase(ditr);
  }

  edge_table e_t(_self, get_self().value);
  auto eitr = e_t.begin();
  while (eitr != e_t.end()) {
    eitr = e_t.erase(eitr);
  }
}

ACTION daoinf::initdao(const name & creator, const uint64_t & dao_id) {
  require_auth(get_self());

  // creates the root node
  hypha::ContentGroups root_cgs {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, FIXED_DETAILS),
      hypha::Content(TYPE, graph::ROOT),
      hypha::Content(OWNER, get_self())
    }
  };


  // creates the daos node
  hypha::ContentGroup daos {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, FIXED_DETAILS),
      hypha::Content(TYPE, graph::DAOS),
      hypha::Content(OWNER, get_self())
    }
  };

  // creates the dao info node
  hypha::ContentGroups dao_info_cgs {
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, FIXED_DETAILS),
      hypha::Content(CREATOR, creator),
      hypha::Content(OWNER, get_self())
    },
    hypha::ContentGroup {
      hypha::Content(hypha::CONTENT_GROUP_LABEL, VARIABLE_DETAILS),
      hypha::Content(OWNER, get_self())
    }
  };

  hypha::Document root_doc(get_self(), get_self(), std::move(root_cgs));
  hypha::Document daos_doc(get_self(), get_self(), std::move(daos));
  hypha::Document dao_info_doc(get_self(), get_self(), std::move(dao_info_cgs));

  hypha::Edge::write(get_self(), get_self(), root_doc.getHash(), daos_doc.getHash(), graph::OWNS_DAO_INFO);
  hypha::Edge::write(get_self(), get_self(), daos_doc.getHash(), dao_info_doc.getHash(), graph::HAS_DAOS);
  hypha::Edge::write(get_self(), get_self(), dao_info_doc.getHash(), daos_doc.getHash(), name(dao_id));
}

ACTION daoinf::storeentry(const std::vector<hypha::Content> & values, const uint64_t &dao_id) {
  hypha::Document dao_doc = get_dao_node(dao_id);
  hypha::Document * node_doc = &dao_doc;

  hypha::ContentWrapper dao_cw = dao_doc.getContentWrapper();

  name creator = dao_cw.getOrFail(FIXED_DETAILS, CREATOR) -> getAs<name>();

  name auth = has_auth(creator) ? creator : get_self();
  require_auth(auth);

  update_node(&dao_doc, VARIABLE_DETAILS, values);
}

ACTION daoinf::delentry(const std::vector<string> & labels, const uint64_t &dao_id) {
  hypha::Document dao_doc = get_dao_node(dao_id);
  hypha::Document * node_doc = &dao_doc;

  hypha::ContentWrapper dao_cw = dao_doc.getContentWrapper();

  name creator = dao_cw.getOrFail(FIXED_DETAILS, CREATOR) -> getAs<name>();

  name auth = has_auth(creator) ? creator : get_self();
  require_auth(auth);

  for (int i = 0; i < labels.size(); i++) {
    if (labels[i] != VARIABLE_DETAILS) {
      dao_cw.removeContent(VARIABLE_DETAILS, labels[i]);
    } else {
      check(false, "Cannot delete the variable details content");
    }
  }

  m_documentGraph.updateDocument(get_self(), node_doc -> getHash(), node_doc -> getContentGroups());
}

void daoinf::update_node (hypha::Document * node_doc, const string & content_group_label, const std::vector<hypha::Content> & new_contents) {
  checksum256 old_node_hash = node_doc -> getHash();

  hypha::ContentWrapper node_cw = node_doc -> getContentWrapper();
  hypha::ContentGroup * node_cg = node_cw.getGroupOrFail(content_group_label);

  for (int i = 0; i < new_contents.size(); i++) {
    hypha::ContentWrapper::insertOrReplace(*node_cg, new_contents[i]);
  }

  m_documentGraph.updateDocument(get_self(), old_node_hash, node_doc -> getContentGroups());
}

hypha::Document daoinf::get_dao_node (const uint64_t& dao_id) {
  hypha::Document root_doc = get_root_node();
  return get_doc_from_edge(root_doc.getHash(), name(dao_id));
}

hypha::Document daoinf::get_root_node () {
  document_table d_t(get_self(), get_self().value);
  auto root_itr = d_t.begin();

  check(root_itr != d_t.end(), "There is no root node");

  hypha::Document root_doc(get_self(), root_itr -> getHash());
  return root_doc;
}

hypha::Document daoinf::get_doc_from_edge (const checksum256 & node_hash, const name & edge_name) {
  std::vector<hypha::Edge> edges = m_documentGraph.getEdgesFromOrFail(node_hash, edge_name);
  hypha::Document node_to(get_self(), edges[0].getToNode());
  return node_to;
}

bool daoinf::edge_exists (const checksum256 & from_node_hash, const name & edge_name) {
  std::vector<hypha::Edge> edges = m_documentGraph.getEdgesFrom(from_node_hash, edge_name);
  return edges.size() > 0;
}
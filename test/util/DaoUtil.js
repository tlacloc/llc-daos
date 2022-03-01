const { createRandomAccount, randomAccountName } = require('../../scripts/eosio-util')

class Dao {

  constructor (
    dao,
    creator,
    ipfs,
    attributes,
    tokens
  ) {
    this.params = {
      dao,
      creator,
      ipfs,
      attributes,
      tokens
    }
  }

  getActionParams () {

    return [
      this.params.dao,
      this.params.creator,
      this.params.ipfs
    ]
  }

  getActionCreateParams () {

    return [
      this.params.dao,
      this.params.creator,
      this.params.ipfs
    ]
  }

}

class DaosFactory {

  static createEntry ({
    dao,
    creator,
    ipfs,
    attributes,
    tokens
  }) {
    return new Dao (
      dao,
      creator,
      ipfs,
      attributes,
      tokens
    )
  }

  static async createWithDefaults ({
    dao,
    creator,
    ipfs,
    attributes,
    tokens

  }) {
    if (!dao) {
      dao = await createRandomAccount() 
    }
    
    if (!creator) {
      creator = await createRandomAccount() 
    }

    if (!ipfs) {
      ipfs = "ipfs://Qm" + await randomAccountName()
    }

    if (!attributes) {
      attributes = []
    }

    if (!tokens) {
      tokens = []
    }

    return DaosFactory.createEntry({
      dao,
      creator,
      ipfs,
      attributes,
      tokens
    })
  }

}

module.exports = { Dao, DaosFactory }
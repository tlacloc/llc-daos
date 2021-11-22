const { createRandomAccount } = require('../../scripts/eosio-util')

class Dao {

  constructor (
    dao,
    creator,
    ipfs
  ) {
    this.params = {
      dao,
      creator,
      ipfs
    }
  }

  getActionParams () {

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
    ipfs
  }) {
    return new Dao (
      dao,
      creator,
      ipfs
    )
  }

  static async createWithDefaults ({
    dao,
    creator,
    ipfs

  }) {
    if (!dao) {
      dao = await createRandomAccount() 
    }
    
    if (!creator) {
      creator = await createRandomAccount() 
    }

    if (!ipfs) {
      ipfs = "ipfs://xyz"
    }

    return ReferendumsFactory.createEntry({
      dao,
      creator,
      ipfs
    })
  }

}

module.exports = { Dao, DaosFactory }
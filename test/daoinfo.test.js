const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts } = require('../scripts/eosio-util')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')

const { daoinf, daoreg } = contractNames
const creator = 'edwintestnet' // The creator should be able to sign transactions (Change it for chain existing account)

describe('Dao info', async function () {
  let contracts

  before(async function () {

    if (!isLocalNode()) {
      console.log('These tests should only be run on local node')
      process.exit(1)
    }

    contracts = await getContracts([daoinf])
  })

  beforeEach(async function () {
    await contracts.daoinf.reset({ authorization: `${daoinf}@active` })
  })

  it('Create root node and dao node', async () => {
    await contracts.daoinf.initdao("edwintestnet", { authorization: `${daoinf}@active` })

    const documentTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    assert.deepStrictEqual(documentTable.rows[1].content_groups, [
      [
        {
          "label": "content_group_label",
          "value": [
            "string",
            "fixed_details"
          ]
        },
        {
          "label": "creator",
          "value": [
            "name",
            "edwintestnet"
          ]
        },
        {
          "label": "owner",
          "value": [
            "name",
            "daoinfor1111"
          ]
        }
      ],
      [
        {
          "label": "content_group_label",
          "value": [
            "string",
            "variable_details"
          ]
        },
        {
          "label": "owner",
          "value": [
            "name",
            "daoinfor1111"
          ]
        }
      ]
    ])
  })

  it('Create new entry', async () => {
    await contracts.daoinf.initdao("edwintestnet", { authorization: `${daoinf}@active` })

    const contentToCreate = {
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }

    await contracts.daoinf.addentry(contentToCreate, { authorization: `${creator}@active` }) // Creator auth

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 2)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToCreate, foundContent)
  })

  it('Update entry', async () => {
    await contracts.daoinf.initdao("edwintestnet", { authorization: `${daoinf}@active` })


    const contentToCreate = {
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }

    await contracts.daoinf.addentry(contentToCreate, { authorization: `${daoinf}@active` })

    const contentToUpdate = {
      "label": "allowed_account",
      "value": ["name", "edwintestne1"]
    }

    await contracts.daoinf.editentry(contentToUpdate, { authorization: `${daoinf}@active` })


    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 3)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToUpdate, foundContent)
  })

  it('Delete entry', async () => {
    await contracts.daoinf.initdao("edwintestnet", { authorization: `${daoinf}@active` })


    const contentToCreate = {
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }

    await contracts.daoinf.addentry(contentToCreate, { authorization: `${daoinf}@active` })

    const documentsTableB = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocumentB = documentsTableB.rows.find(el => el.id === 2)

    const foundContentB = daoDocumentB.content_groups[1].find(el => el.label === 'allowed_account')

    console.log('Entry exists before delete')
    assert.deepStrictEqual(foundContentB, contentToCreate)

    await contracts.daoinf.delentry("allowed_account", { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 3)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    
    console.log('Entry doesn\'t exists after delete')
    assert.deepStrictEqual(foundContent, undefined)
  })

  it('Add many entries', async () => {
    await contracts.daoinf.initdao("edwintestnet", { authorization: `${daoinf}@active` })


    const contentToCreate1 = {
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }

    const contentToCreate2 = {
      "label": "number_of_allowed",
      "value": ["int64", 10]
    }

    const contentToCreate3 = {
      "label": "city",
      "value": ["string", "New york"]
    }

    await contracts.daoinf.addentry(contentToCreate1, { authorization: `${daoinf}@active` })
    await contracts.daoinf.addentry(contentToCreate2, { authorization: `${daoinf}@active` })
    await contracts.daoinf.addentry(contentToCreate3, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 4)

    const foundContent1 = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    const foundContent2 = daoDocument.content_groups[1].find(el => el.label === 'number_of_allowed')
    const foundContent3 = daoDocument.content_groups[1].find(el => el.label === 'city')

    assert.deepStrictEqual(foundContent1, contentToCreate1)
    assert.deepStrictEqual(foundContent2, contentToCreate2)
    assert.deepStrictEqual(foundContent3, contentToCreate3)
  })
})

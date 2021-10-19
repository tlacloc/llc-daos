const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts } = require('../scripts/eosio-util')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { AssertionError } = require('assert')

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
    await contracts.daoinf.initdao("edwintestnet", 1,{ authorization: `${daoinf}@active` })

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
          "label": "type",
          "value": [
            "name",
            "daosnode"
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
    await contracts.daoinf.initdao("edwintestnet", 1,{ authorization: `${daoinf}@active` })

    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 1,{ authorization: `${creator}@active` }) // Creator auth

    const documentTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })
    console.log(documentTable);
    console.log(documentTable.rows.find(el => el.id === 3));

    const daoDocument = documentTable.rows.find(el => el.id === 3)
    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToCreate[0], foundContent)

  })

  it('Update entry', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })


    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 1, { authorization: `${daoinf}@active` })

    const contentToUpdate = [{
      "label": "allowed_account",
      "value": ["name", "edwintestne1"]
    }]

    await contracts.daoinf.storeentry(contentToUpdate, 1, { authorization: `${daoinf}@active` })


    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 4)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToUpdate[0], foundContent)
  })

  it('Delete entry', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })

    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 1, { authorization: `${daoinf}@active` })

    const documentsTableB = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocumentB = documentsTableB.rows.find(el => el.id === 3)

    const foundContentB = daoDocumentB.content_groups[1].find(el => el.label === 'allowed_account')

    console.log('Entry exists before delete')
    assert.deepStrictEqual(foundContentB, contentToCreate[0])

    await contracts.daoinf.delentry(["allowed_account"], 1, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 4)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    
    console.log('Entry doesn\'t exists after delete')
    assert.deepStrictEqual(foundContent, undefined)

    try {
      await contracts.daoinf.delentry(["variable_details"], 1, { authorization: `${daoinf}@active` })
    } catch (error) {
      assert.deepStrictEqual(error.message, "assertion failure with message: Cannot delete the variable details content")
    }
  })

  it('Add many entries', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })


    const contentToCreate1 = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    },
    {
      "label": "number_of_allowed",
      "value": ["int64", 10]
    },
    {
      "label": "city",
      "value": ["string", "New york"]
    }]


    await contracts.daoinf.storeentry(contentToCreate1, 1, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 3)

    const foundContent1 = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    const foundContent2 = daoDocument.content_groups[1].find(el => el.label === 'number_of_allowed')
    const foundContent3 = daoDocument.content_groups[1].find(el => el.label === 'city')

    assert.deepStrictEqual(foundContent1, contentToCreate1[0])
    assert.deepStrictEqual(foundContent2, contentToCreate1[1])
    assert.deepStrictEqual(foundContent3, contentToCreate1[2])
  })

  it('Delete many entries', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })


    const contentToCreate1 = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    },
    {
      "label": "number_of_allowed",
      "value": ["int64", 10]
    },
    {
      "label": "city",
      "value": ["string", "New york"]
    }]


    await contracts.daoinf.storeentry(contentToCreate1, 1, { authorization: `${daoinf}@active` })

    await contracts.daoinf.delentry(["allowed_account", "number_of_allowed"], 1, { authorization: `${daoinf}@active` })

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

    assert.deepStrictEqual(foundContent1, undefined)
    assert.deepStrictEqual(foundContent2, undefined)
    assert.deepStrictEqual(foundContent3, contentToCreate1[2])
  })

  it('Create new dao', async () => {

    await contracts.daoinf.initdao("edwintestnet", 1,{ authorization: `${daoinf}@active` })

    await contracts.daoinf.adddao("newdao", 2,{ authorization: `${daoinf}@active` })

    const documentTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    console.log(documentTable.rows[3].content_groups)

    assert.deepStrictEqual(documentTable.rows[3].content_groups, [
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
            "newdao"
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

  it('Create new entry in other dao', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1,{ authorization: `${daoinf}@active` })
    await contracts.daoinf.adddao("newdao", 2,{ authorization: `${daoinf}@active` })

    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "newdao"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 2,{ authorization: `${daoinf}@active` })

    const documentTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })
    console.log(documentTable);
    console.log(documentTable.rows.find(el => el.id === 4));

    const daoDocument = documentTable.rows.find(el => el.id === 4)
    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToCreate[0], foundContent)

  })

  it('Update entry in other dao', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })
    await contracts.daoinf.adddao("newdao", 2,{ authorization: `${daoinf}@active` })

    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "newdao"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 2, { authorization: `${daoinf}@active` })

    const contentToUpdate = [{
      "label": "allowed_account",
      "value": ["name", "newdao1"]
    }]

    await contracts.daoinf.storeentry(contentToUpdate, 2, { authorization: `${daoinf}@active` })


    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 5)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')

    assert.deepStrictEqual(contentToUpdate[0], foundContent)
  })

  it('Delete entry in other dao', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })
    await contracts.daoinf.adddao("newdao", 2,{ authorization: `${daoinf}@active` })

    const contentToCreate = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    }]

    await contracts.daoinf.storeentry(contentToCreate, 2, { authorization: `${daoinf}@active` })

    const documentsTableB = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    console.log(documentsTableB);

    const daoDocumentB = documentsTableB.rows.find(el => el.id === 4)

    const foundContentB = daoDocumentB.content_groups[1].find(el => el.label === 'allowed_account')

    console.log('Entry exists before delete')
    assert.deepStrictEqual(foundContentB, contentToCreate[0])

    await contracts.daoinf.delentry(["allowed_account"], 2, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 5)

    const foundContent = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    
    console.log('Entry doesn\'t exists after delete')
    assert.deepStrictEqual(foundContent, undefined)

    try {
      await contracts.daoinf.delentry(["variable_details"], 2, { authorization: `${daoinf}@active` })
    } catch (error) {
      assert.deepStrictEqual(error.message, "assertion failure with message: Cannot delete the variable details content")
    }
  })

  it('Add many entries in other dao', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })


    const contentToCreate1 = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    },
    {
      "label": "number_of_allowed",
      "value": ["int64", 10]
    },
    {
      "label": "city",
      "value": ["string", "New york"]
    }]


    await contracts.daoinf.storeentry(contentToCreate1, 1, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 3)

    const foundContent1 = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    const foundContent2 = daoDocument.content_groups[1].find(el => el.label === 'number_of_allowed')
    const foundContent3 = daoDocument.content_groups[1].find(el => el.label === 'city')

    assert.deepStrictEqual(foundContent1, contentToCreate1[0])
    assert.deepStrictEqual(foundContent2, contentToCreate1[1])
    assert.deepStrictEqual(foundContent3, contentToCreate1[2])
  })

  it('Delete many entries in other dao', async () => {
    await contracts.daoinf.initdao("edwintestnet", 1, { authorization: `${daoinf}@active` })
    await contracts.daoinf.adddao("newdao", 2,{ authorization: `${daoinf}@active` })

    const contentToCreate1 = [{
      "label": "allowed_account",
      "value": ["name", "edwintestnet"]
    },
    {
      "label": "number_of_allowed",
      "value": ["int64", 10]
    },
    {
      "label": "city",
      "value": ["string", "New york"]
    }]


    await contracts.daoinf.storeentry(contentToCreate1, 2, { authorization: `${daoinf}@active` })

    await contracts.daoinf.delentry(["allowed_account", "number_of_allowed"], 2, { authorization: `${daoinf}@active` })

    const documentsTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'documents',
      json: true,
      limit: 100
    })

    const daoDocument = documentsTable.rows.find(el => el.id === 5)

    const foundContent1 = daoDocument.content_groups[1].find(el => el.label === 'allowed_account')
    const foundContent2 = daoDocument.content_groups[1].find(el => el.label === 'number_of_allowed')
    const foundContent3 = daoDocument.content_groups[1].find(el => el.label === 'city')

    assert.deepStrictEqual(foundContent1, undefined)
    assert.deepStrictEqual(foundContent2, undefined)
    assert.deepStrictEqual(foundContent3, contentToCreate1[2])
  })

})

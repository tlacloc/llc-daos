# llc-daos

## setup project 

### Environment variables

create a .env file based on .env.example

command: 
```bash
cp .env.example .env
```
### Nodejs

Download the libraries by running

```bash
npm install
```

### Git submodules

To setup the submodules just run the following commands:

```bash
git submodule init
git submodule update
```

Compile & test files from submodule ( description in document-graph/readme.md or [hypha repository](https://github.com/hypha-dao/document-graph/tree/23d2b74e82afce8f72f091bc7933b97b126dca26) )


Copy document-graph/include/document_graph & document-graph/include/logger to include/, document-graph/scr/document_graph to src

or by terminal just running 

```bash
cp -r document-graph/include/document_graph document-graph/include/logger include/
cp -r document-graph/src/document_graph src/
```


## compile contract

To compile one contract, check for the file name as FILENAME.cpp on src/ to see the contract name or in the file scripts/config.js search for the constant 
`contractsConfig`

command:
```bash
node scripts/commands.js compile CONTRACTNAME
```

### example:

```bash
node scripts/commands.js compile daoreg
```

## test

To run the test simply run:
```bash
npm run test
```

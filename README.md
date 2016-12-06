# composex
This tool let you add *includes* section for docker compose 2 which allow you to extends or combine multiple docker compose files.

## What is it

### common.yml
```yaml
    version: '2'
    services:
      nginx:
        build: .
        links:
          - db

      db:
        image: mongo:3.0.14
```
### web.yml
```yaml
    version: '2'
    includes:
      nsA: "/path/to/common.yml"
    services:
      web:
        image: thanhpk/web:v2.0.4
      links:
        - nsA.nginx: nginx
        - nsA.db: db
```
```sh
$ composex web.yml
```
### output
```yaml
    version: '2'
    includes:
      nsA: "/path/to/common.yml"
    services:
      web:
        image: thanhpk/web:v2.0.4
      links:
        - nsA.nginx: nginx
        - nsA.db: db
		
      nsA.nginx:
        build: .
        links:
          - nsA.db: db

      nsA.db:
        image: mongo:3.0.14
```
## what about docker composer extends
docker compose currently don't let you extend a service which has links ([#1617](https://github.com/docker/compose/issues/1617))
## install
`npm install -g composex`

## how to use
`composex` take only one parameter, the path to the yml, the path could be absolute path or relative path in the file system, or the url (http, https) to the yaml file

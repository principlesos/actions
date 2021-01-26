# Get Deployment Credentials

This GitHub Action sets a number of envvars needed throughout the build process

## General

```yml
- uses: principlesos/actions/set-envars@v1.3
```
NOTE: Three variables need to be set at the project level:
```yml
env:
  PROJECT_NAME:             example/gh-app-test
  DOCKER_LOGIN_SERVER:      ***-docker-all.jfrog.io
  IMAGE_VERSION:            1.0.0
```


### Envvars Written Out
* BRANCH_NAME - The name of the branch
* SANITIZED_BRANCH_NAME -  tr -cd [:alnum:] of the BRANCH_NAME
* TAG_PREFIX - if main ref adds "v",  if anything else, uses $SANITIZED_BRANCH_NAME
* DRY_RUN - if main "true", else "false"
* COMPUTED_TAG - Concatination of SANITIZED_BRANCH_NAME, IMAGE_VERSION and github sha
* VERSION - Just IMAGE_VERSION
* SHORT_TAG - Concatination of SANITIZED_BRANCH_NAME & IMAGE_VERSION
* DOCKER_FQIN - Concatination of DOCKER_LOGIN_SERVER, PROJECT_NAME and COMPUTED_TAG

Addionally there are some envars set for Jfrog CLI purposes that you likely wont need to access, but just in case here they are:
* JFROG_CLI_BUILD_URL - Link information for JFROG CLI purposes
* JFROG_CLI_BUILD_NAME - PROJECT_NAME. Set for JFROG CLI purposes
* JFROG_CLI_BUILD_NUMBER - Set for JFROG CLI purposes
* JFROG_CLI_OFFER_CONFIG - Tells CLI not to try to configure through user input
* JFROG_CLI_ENV_EXCLUDE - instructs Jfrog CLI not to grab sensetive credentials

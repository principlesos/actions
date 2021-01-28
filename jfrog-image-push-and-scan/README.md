# Jfrog Docker/Build Push and Scan

This GitHub Action pushes a previously built docker image & its associated build info to docker. It then requests jfrog scan the image for vulnerabilities and returns the results. The build will be failed if the results of the

## General

### Usage
```yml
- uses: principlesos/actions/jfrog-image-push-and-scan@v1.3.2
  with:
    jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
    jf-repo: ${{ secrets.JFROG_DEV_REPO }}
    jf-tenant: ${{ secrets.JFROG_TENANT }}
```
NOTE: Several variables need to be set prior to the step or manually input (see multiple image example below):
```yml
  PROJECT_NAME: Your project name. Will be logged for build name.
  DOCKER_FQIN: tag for the docker image
  COMPUTED_TAG: A identifier unique to the build-name used as the "build-number". Different from the docker tag
  SANITIZED_BRANCH_NAME: A clean branch name
  IMAGE_VERSION: Semver for the build
```

IF BUILDING MULTIPLE IMAGES IN THE SAME JOB:
- It is reccomended you manually override some of the implicit parameters to avoid image confusion
- ex:
```yml
- uses: principlesos/actions/jfrog-image-push-and-scan@v1.3.2
  with:
    jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
    jf-repo: ${{ secrets.JFROG_DEV_REPO }}
    jf-tenant: ${{ secrets.JFROG_TENANT }}
    build-name: specific name for this particular image
    build-number: some identifier unique to the build name. Can be shared between builds if you want to link them
    docker-fqin: Tag on the docker image you want to push and scan
```

### Optional Parameters:
`skip-scan` can be added to skip the scan report for the built image. It will still be scanned by jfrog, with a report viewable in the UI.

A passing scan is a requirement for deployment, so it is reccomended you DO NOT skip scanning even in lower environments as it is easier to fail early and fix things then.

```yml
- uses: principlesos/actions/jfrog-image-push-and-scan@v1.3.2
  with:
    jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
    jf-repo: ${{ secrets.JFROG_DEV_REPO }}
    jf-tenant: ${{ secrets.JFROG_TENANT }}
    skip-scan: true
```

Parameters and their default values:

```yml
docker-fqin: ${DOCKER_FQIN}
build-name: ${PROJECT_NAME}
build-number: ${COMPUTED_TAG}
branch-name: ${SANITIZED_BRANCH_NAME}
image-version: ${IMAGE_VERSION}
```
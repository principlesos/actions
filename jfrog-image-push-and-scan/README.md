# Jfrog Docker/Build Push and Scan

This GitHub Action pushes a previously built docker image & its associated build info to docker. It then requests jfrog scan the image for vulnerabilities and returns the results. The build will be failed if the results of the

## General

### Usage
```yml
- uses: ./actions/jfrog@v1.3
  with:
    jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
    jf-repo: ${{ secrets.JFROG_DEV_REPO }}
    jf-tenant: ${{ secrets.JFROG_TENANT }}
```
NOTE: One variables needs to be set at the project level:
```yml
env:
  PROJECT_NAME: example/gh-app-test
```

### Optional Parameters:
`skip-scan` can be added to skip the scan report for the built image. It will still be scanned by jfrog, with a report viewable in the UI.

A passing scan is a requirement for deployment, so it is reccomended you DO NOT skip scanning even in lower environments as it is easier to fail early and fix things then.

```yml
- uses: ./actions/jfrog
  with:
    jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
    jf-repo: ${{ secrets.JFROG_DEV_REPO }}
    jf-tenant: ${{ secrets.JFROG_TENANT }}
    skip-scan: true
```

Additionally the `set-envars` action needs to be run BEFORE any Docker Build Step. Docker Images need to be built BEFORE this action

### For a working example reference the below:
```yml
      - name: Configure and Save Envvars
        uses: principlesos/actions/set-envvars@v1.3

      - name: Docker Build & Tag app
        run: |
          docker build \
            --file  Dockerfile \
            --label git.repo=${{ github.repository }} \
            --label git.ref=${{ github.ref }} \
            --label git.sha=${{ github.sha }} \
            --label project.semver=${VERSION} \
            --label project.tag=${SHORT_TAG} \
            --label build-name=${PROJECT_NAME} \
            --label build-number=${{ github.run_number }} \
            --tag ${DOCKER_FQIN} \
            .

      - uses: principlesos/actions/set-envvars@v1.3
        with:
          jf-token: ${{ secrets.JFROG_SERVER_TOKEN }}
          jf-repo: ${{ secrets.JFROG_DEV_REPO }}
          jf-tenant: ${{ secrets.JFROG_TENANT }}
```
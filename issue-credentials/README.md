# Get Deployment Credentials

This GitHub Action asks [image-gatekeeper](https://github.com/principlesos/image-gatekeeper) for ephemeral AWS credentials for the running job. Gatekeeper verifies the job is really running, holds production environments to the same repository rules it applies before promoting an image, and issues the credentials if the checks pass.

Right now the types issued are:

* Kubernetes - Obtains a kubeconfig for the requested EKS environemnt and uses that context. Additionally sets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_REGION`, and `AWS_SESSION_TOKEN` for use in later job steps
* Terraform - Sets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_REGION`, and `AWS_SESSION_TOKEN` for use in later job steps

- [Get Deployment Credentials](#get-deployment-credentials)
- [Usage](#usage)
  - [General](#general)
  - [Reusable Workflows](#reusable-workflows)
    - [Caller Workflow](#caller-workflow)
    - [Reusable Workflow](#reusable-workflow)

# Usage

## General

```yml
- uses: principlesos/actions/issue-credentials@v2.1.0
  with:
    type: kubernetes
    environment: box
    cluster_name: eks-cluster
    permissions_level: read-write
```

`base_url` defaults to image-gatekeeper (`https://image-gatekeeper.mgt10.principles.com/api/v1/credentials`), so it no longer needs to be supplied. Workflows that still pass `base_url: ${{ secrets.CREDENTIALS_BROKER_URL }}` keep working: the secret points at the same place, and once it is removed the action falls back to the default on its own. Only set `base_url` to point at a different broker.

types available:

* kubernetes
* terraform
  * `cluster_name` is not required for terraform type as it is implicit in the AWS credentials

environment and cluster_name follows our standard infrastructure naming conventions

Permissions levels available:

* read-write
* read-only

Optional Parameters with default vaules (do not input other values unless you really know why you're doing it):
NOTE: If you are giving your job a name via the the optional name parameter in `build.yml`, you NEED to provide that name via the action parameters.

```yml
    example_job:
        name: A Different name than 'example_job'
```

```yml
    aws_region: us-east-1
    gh_token: ${{ github.token }}
    gh_job: ${{ github.job }}
```

## Reusable Workflows

The following is a bare-bones example of how to build reusable workflows that interface with the issue-credentials action.

### Caller Workflow

```yaml
name: Caller Workflow
jobs:
  call-reusable-workflow:
    uses: principlesos/<repository name>/.github/workflows/<reusable workflow file name>@main
    with:
      environment: dev
      caller_job_name: call-reusable-workflow # set to name of calling job
```

### Reusable Workflow

```yaml
name: Reusable Workflow

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      caller_job_name:
        required: true
        type: string
jobs:
  reusable-workflow-job:
    ...
    steps:
      - uses: principlesos/actions/issue-credentials@v2.1.0
        with:
          type: terraform
          environment: ${{ inputs.environment_name }}
          permissions_level: read-write
          gh_job: ${{ inputs.caller_job_name }} / ${{ github.job }}
      ...
```

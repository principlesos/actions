# Get Deployment Credentials

This GitHub Action hits the promotion service, assesses the repository and image against security standards and issues the requested ephemeral credentials if the checks are passed

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
- uses: principlesos/actions/issue-credentials@v1
  with:
    base_url: ${{ secrets.CREDENTIALS_BROKER_URL }}
    type: kubernetes
    environment: box
    cluster_name: eks-cluster
    permissions_level: read-write
```

We are using the CREDENTIALS_BROKER_URL as an org wide secret so you will not need to set it at the repo level.
Unfortunately it cant be as a default input so does need to be supplied in the "with" section.

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
    secrets:
      CREDENTIALS_BROKER_URL: ${{ secrets.CREDENTIALS_BROKER_URL }}
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
    secrets:
      CREDENTIALS_BROKER_URL:
        required: true
jobs:
  reusable-workflow-job:
    ...
    steps:
      - uses: principlesos/actions/issue-credentials@v1.4.7
        with:
          base_url: ${{ secrets.CREDENTIALS_BROKER_URL }}
          type: terraform
          environment: ${{ inputs.environment_name }}
          permissions_level: read-write
          gh_job: ${{ inputs.caller_job_name }} / ${{ github.job }}
      ...
```

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as path from "path";
import * as io from "@actions/io";
import * as toolCache from "@actions/tool-cache";
import * as os from "os";
import { ToolRunner, argStringToArray } from "@actions/exec/lib/toolrunner";
import * as fetch from "node-fetch";

async function getAwsCredentials(job, step) {
  const context = github.context;
  const ghToken = core.getInput("gh_token");
  const type = core.getInput("type", { required: true });
  const environment = core.getInput("environment", { required: true });
  const permissionsLevel = core.getInput("permissions_level", {
    required: true,
  });
  const repo = encodeURIComponent(core.getInput("gh_repo", { required: true }));
  const BASE_URL = core.getInput("base_url", { required: true });
  const url = `${BASE_URL}/token/${ghToken}/${type}/${environment}/${repo}/${job.id}/${context.runId}/${step.number}/${permissionsLevel}`;
  console.log("Calling Credentials Endpoint");
  const response: Response = await fetch(url);
  if (!response.ok) {
    core.setFailed("Failed to receive credentials from service");
    console.log(await response.json());
    return false;
  }
  const body = await response.json();
  return body;
}

async function getGithubRunIDJobs(page = 1) {
  const resultsPerPage = 100;
  const context = github.context;
  const repo = core.getInput("gh_repo", { required: true });
  const url = `https://api.github.com/repos/${repo}/actions/runs/${context.runId}/jobs?page=${page}&per_page=${resultsPerPage}`;
  console.log("Calling Github API for additional information");
  const ghToken = core.getInput("gh_token");
  const response = await fetch(url, {
    method: "get",
    headers: {
      authorization: `Bearer ${ghToken}`,
      "Content-Type": "application/json",
    },
  });
  const { total_count, jobs } = await response.json();
  if (total_count > page * resultsPerPage) {
    const morePages = await getGithubRunIDJobs(page + 1);
    return { jobs: [...jobs, ...morePages] };
  }
  return { jobs };
}

function getGhJob(runJson) {
  const jobName = core.getInput("gh_job");

  const job = runJson.jobs.find(
    (j) => j.name == jobName && j.status == "in_progress"
  );
  if (!job) {
    core.setFailed(`Failed to find in_progress job with name ${jobName}`);
  }
  return job;
}


function setAwsCredentials(credentials) {
  if (!credentials.accessKeyId) {
    console.log("AWS credentials missing, not setting");
  } else {
    core.setSecret(credentials.accessKeyId);
    core.setSecret(credentials.secretAccessKey);
    core.setSecret(credentials.sessionToken);

    core.exportVariable("AWS_ACCESS_KEY_ID", credentials.accessKeyId);
    core.exportVariable("AWS_SECRET_ACCESS_KEY", credentials.secretAccessKey);
    core.exportVariable(
      "AWS_DEFAULT_REGION",
      core.getInput("aws_region", { required: true })
    );
    core.exportVariable(
      "AWS_REGION",
      core.getInput("aws_region", { required: true })
    );
    core.exportVariable("AWS_SESSION_TOKEN", credentials.sessionToken);
    console.log("AWS session credentials set");
  }
}

async function setEksConfig() {
  const cluster_name = core.getInput("cluster_name", { required: true });
  const AwsPath = await getAwsCliPath();
  const kubectlPath = await getKubectlPath();

  let arg_string_arr = argStringToArray(
    `--region us-east-1 eks update-kubeconfig --name "${cluster_name}"  --alias "${cluster_name}"`
  );
  let AWStoolRunner = new ToolRunner(AwsPath, arg_string_arr);
  await AWStoolRunner.exec();

  let KCTLtoolRunner = new ToolRunner(kubectlPath, [
    "config",
    "use-context",
    cluster_name,
  ]);
  await KCTLtoolRunner.exec();
  console.log("EKS config set");
}

function getExecutableExtension(): string {
  if (os.type().match(/^Win/)) {
    return ".exe";
  }

  return "";
}

async function getKubectlPath() {
  let kubectlPath = await io.which("kubectl", false);
  if (!kubectlPath) {
    const allVersions = toolCache.findAllVersions("kubectl");
    kubectlPath =
      allVersions.length > 0 ? toolCache.find("kubectl", allVersions[0]) : "";
    if (!kubectlPath) {
      throw new Error("Kubectl is not installed");
    }

    kubectlPath = path.join(kubectlPath, `kubectl${getExecutableExtension()}`);
  }
  return kubectlPath;
}

async function getAwsCliPath() {
  let AwsPath = await io.which("aws", false);
  if (!AwsPath) {
    const allVersions = toolCache.findAllVersions("aws");
    AwsPath =
      allVersions.length > 0 ? toolCache.find("aws", allVersions[0]) : "";
    if (!AwsPath) {
      throw new Error("AWS Cli is not installed");
    }

    AwsPath = path.join(AwsPath, `aws${getExecutableExtension()}`);
  }
  return AwsPath;
}

async function run() {
  await new Promise((resolve) => setTimeout(resolve, 7500));
  let gh = await getGithubRunIDJobs();
  let job = getGhJob(gh);
  if (job) {
    let step = job.steps.find((s) => s.status == "in_progress");
    let result = await getAwsCredentials(job, step);
    if (result) {
      setAwsCredentials(result);
      let type = core.getInput("type", { required: true }).toLowerCase();
      if (type == "kubernetes") {
        setEksConfig();
      }
      return;
    }
  }
  console.log("credentials not set");
}

run().catch(core.setFailed);

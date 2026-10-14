"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
const path = require("path");
const io = require("@actions/io");
const toolCache = require("@actions/tool-cache");
const os = require("os");
const toolrunner_1 = require("@actions/exec/lib/toolrunner");
const fetch = require("node-fetch");
async function getAwsCredentials(job, step) {
    const context = github.context;
    const ghToken = core.getInput("gh_token");
    const type = core.getInput("type", { required: true });
    const environment = core.getInput("environment", { required: true });
    const permissionsLevel = core.getInput("permissions_level", {
        required: true,
    });
    const ttl = core.getInput("ttl");
    const repo = encodeURIComponent(core.getInput("gh_repo", { required: true }));
    const BASE_URL = core.getInput("base_url", { required: true });
    let url = "";
    if (ttl) {
        url = `${BASE_URL}/token/${ghToken}/${type}/${environment}/${repo}/${job.id}/${context.runId}/${step.number}/${permissionsLevel}/${ttl}`;
    }
    else {
        url = `${BASE_URL}/token/${ghToken}/${type}/${environment}/${repo}/${job.id}/${context.runId}/${step.number}/${permissionsLevel}`;
    }
    console.log("Calling Credentials Endpoint");
    console.log(url);
    const response = await fetch(url);
    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    }
    catch (e) {
        body = text;
    }
    return { ok: response.ok, body };
}
// The broker checks the step against the same jobs API we read, which lags
// behind the runner. A step we saw as in_progress (e.g. a stale "Set up job")
// may have completed by the time the broker looks, so this rejection is worth
// retrying with a fresh read of the job.
function isStepNotInProgressRejection(body) {
    return (body !== null &&
        typeof body === "object" &&
        typeof body.message === "string" &&
        body.message.includes("step not in progress"));
}
async function getGHJobs(page, perPage) {
    const context = github.context;
    const repo = core.getInput("gh_repo", { required: true });
    const url = `https://api.github.com/repos/${repo}/actions/runs/${context.runId}/jobs?page=${page}&per_page=${perPage}`;
    const ghToken = core.getInput("gh_token");
    const response = await fetch(url, {
        method: "get",
        headers: {
            authorization: `Bearer ${ghToken}`,
            "Content-Type": "application/json",
        },
    });
    return await response.json();
}
async function requestCredentials() {
    const maxAttempts = 6;
    const resultsPerPage = 50;
    const jobName = core.getInput("gh_job");
    let allJobsWithName;
    let inProgressJob;
    let rejection;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Checking status of ${jobName}. Attempt: ${attempt}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        allJobsWithName = [];
        inProgressJob = undefined;
        rejection = undefined;
        let totalCount;
        let page = 0;
        do {
            page = page + 1;
            const { total_count, jobs } = await getGHJobs(page, resultsPerPage);
            totalCount = total_count;
            const jobsWithName = jobs.filter((j) => j.name === jobName);
            inProgressJob = jobsWithName.find((j) => j.status === "in_progress");
            allJobsWithName = [...allJobsWithName, ...jobsWithName];
        } while (!inProgressJob && totalCount > page * resultsPerPage);
        if (!inProgressJob) {
            continue;
        }
        // The jobs API can report the job as in_progress before any step is.
        const step = (inProgressJob.steps || []).find((s) => s.status === "in_progress");
        if (!step) {
            console.log(`Job ${jobName} is in progress but no step is in progress yet`);
            continue;
        }
        console.log(inProgressJob.steps);
        const { ok, body } = await getAwsCredentials(inProgressJob, step);
        if (ok) {
            return body;
        }
        if (!isStepNotInProgressRejection(body)) {
            core.setFailed("Failed to receive credentials from service");
            console.log(body);
            return null;
        }
        console.log(`Credentials service saw step ${step.number} (${step.name}) as not in progress, retrying`);
        rejection = body;
    }
    if (rejection) {
        core.setFailed(`Credentials service rejected the in progress step of ${jobName} on all ${maxAttempts} attempts`);
        console.log(rejection);
    }
    else if (inProgressJob) {
        core.setFailed(`Found in progress job ${jobName} (id ${inProgressJob.id}) but no step was in progress after ${maxAttempts} attempts`);
    }
    else {
        core.setFailed(`Failed to find in progress job ${jobName} after ${maxAttempts} attempts`);
        console.log(JSON.stringify({ jobs: allJobsWithName }, null, 2));
    }
    if (inProgressJob) {
        const steps = (inProgressJob.steps || []).map(({ name, number, status }) => ({
            name,
            number,
            status,
        }));
        console.log(JSON.stringify({ steps }, null, 2));
    }
    return null;
}
function setAwsCredentials(credentials) {
    if (!credentials.accessKeyId) {
        console.log("AWS credentials missing, not setting");
    }
    else {
        core.setSecret(credentials.accessKeyId);
        core.setSecret(credentials.secretAccessKey);
        core.setSecret(credentials.sessionToken);
        core.exportVariable("AWS_ACCESS_KEY_ID", credentials.accessKeyId);
        core.exportVariable("AWS_SECRET_ACCESS_KEY", credentials.secretAccessKey);
        core.exportVariable("AWS_DEFAULT_REGION", core.getInput("aws_region", { required: true }));
        core.exportVariable("AWS_REGION", core.getInput("aws_region", { required: true }));
        core.exportVariable("AWS_SESSION_TOKEN", credentials.sessionToken);
        console.log("AWS session credentials set");
    }
}
async function setEksConfig() {
    const cluster_name = core.getInput("cluster_name", { required: true });
    const AwsPath = await getAwsCliPath();
    const kubectlPath = await getKubectlPath();
    let arg_string_arr = toolrunner_1.argStringToArray(`--region us-east-1 eks update-kubeconfig --name "${cluster_name}"  --alias "${cluster_name}"`);
    let AWStoolRunner = new toolrunner_1.ToolRunner(AwsPath, arg_string_arr);
    await AWStoolRunner.exec();
    let KCTLtoolRunner = new toolrunner_1.ToolRunner(kubectlPath, [
        "config",
        "use-context",
        cluster_name,
    ]);
    await KCTLtoolRunner.exec();
    console.log("EKS config set");
}
function getExecutableExtension() {
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
    const result = await requestCredentials();
    if (result) {
        setAwsCredentials(result);
        let type = core.getInput("type", { required: true }).toLowerCase();
        if (type === "kubernetes") {
            setEksConfig();
        }
        return;
    }
    console.log("credentials not set");
}
run().catch(core.setFailed);

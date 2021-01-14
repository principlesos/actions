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
    const type = core.getInput('type', { required: true });
    const environment = core.getInput('environment', { required: true });
    const permissionsLevel = core.getInput('permissions_level', { required: true });
    const repo = encodeURIComponent(context.payload.repository.full_name);
    const BASE_URL = core.getInput('base_url', { required: true });
    const url = `${BASE_URL}/${type}/${environment}/${repo}/${job.id}/${context.runId}/${step.number}/${permissionsLevel}`;
    console.log('Calling Credentials Endpoint');
    const response = await fetch(url);
    const body = await response.json();
    return body;
}
async function getGithubRunIDJobs() {
    const context = github.context;
    const repo = context.payload.repository.full_name;
    const url = `https://api.github.com/repos/${repo}/actions/runs/${context.runId}/jobs`;
    console.log('Calling Github API for additional information');
    const ghToken = core.getInput('gh_token');
    const response = await fetch(url, {
        method: 'get',
        headers: {
            'authorization': `Bearer ${ghToken}`,
            'Content-Type': 'application/json'
        }
    });
    const body = await response.json();
    return body;
}
function getGhJob(runJson) {
    const jobName = core.getInput('gh_job');
    return runJson.jobs.find(j => j.name == jobName && j.status == "in_progress");
}
function setAwsCredentials(credentials) {
    core.exportVariable('AWS_ACCESS_KEY_ID', credentials.accessKeyId);
    core.exportVariable('AWS_SECRET_ACCESS_KEY', credentials.secretAccessKey);
    core.exportVariable('AWS_DEFAULT_REGION', core.getInput('aws_region', { required: true }));
    core.exportVariable('AWS_SESSION_TOKEN', credentials.sessionToken);
    console.log("AWS session credentials set");
}
async function setEksConfig() {
    const cluster_name = core.getInput('cluster_name', { required: true });
    const AwsPath = await getAwsCliPath();
    const kubectlPath = await getKubectlPath();
    let arg_string_arr = toolrunner_1.argStringToArray(`--region us-east-1 eks update-kubeconfig --name "${cluster_name}"  --alias "${cluster_name}"`);
    let AWStoolRunner = new toolrunner_1.ToolRunner(AwsPath, arg_string_arr);
    await AWStoolRunner.exec();
    let KCTLtoolRunner = new toolrunner_1.ToolRunner(kubectlPath, ['config', 'use-context', cluster_name]);
    await KCTLtoolRunner.exec();
    console.log("EKS config set");
}
function getExecutableExtension() {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }
    return '';
}
async function getKubectlPath() {
    let kubectlPath = await io.which('kubectl', false);
    if (!kubectlPath) {
        const allVersions = toolCache.findAllVersions('kubectl');
        kubectlPath = allVersions.length > 0 ? toolCache.find('kubectl', allVersions[0]) : '';
        if (!kubectlPath) {
            throw new Error('Kubectl is not installed');
        }
        kubectlPath = path.join(kubectlPath, `kubectl${getExecutableExtension()}`);
    }
    return kubectlPath;
}
async function getAwsCliPath() {
    let AwsPath = await io.which('aws', false);
    if (!AwsPath) {
        const allVersions = toolCache.findAllVersions('aws');
        AwsPath = allVersions.length > 0 ? toolCache.find('aws', allVersions[0]) : '';
        if (!AwsPath) {
            throw new Error('AWS Cli is not installed');
        }
        AwsPath = path.join(AwsPath, `aws${getExecutableExtension()}`);
    }
    return AwsPath;
}
async function run() {
    await new Promise(resolve => setTimeout(resolve, 1500));
    let gh = await getGithubRunIDJobs();
    let job = getGhJob(gh);
    let step = job.steps.find(s => s.status == "in_progress");
    let result = await getAwsCredentials(job, step);
    setAwsCredentials(result);
    let type = core.getInput('type', { required: true }).toLowerCase();
    if (type == "kubernetes") {
        setEksConfig();
    }
}
run().catch(core.setFailed);

import * as core from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import * as yaml from 'js-yaml';

interface Label
{
    name: string;
    description: string | undefined;
    color: string;
}

async function run() {
    try {
        const token = core.getInput('repo-token', { required: true });
        const configurationPath = core.getInput('configuration-path', { required: true });
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });

        const client = getOctokit(token);

        
        core.debug(`Fetching current labels for ${owner}/${repo}`);
        var currentLabels = await getLabels(client, owner, repo);
        core.debug(`Retreived ${currentLabels.length} labels`);

        const desiredLabels = await getConfiguration(client, configurationPath);

        // Delete Labels
        for (const label of currentLabels) {
            if (desiredLabels.findIndex(l => l.name == label.name) == -1) {
                await deleteLabel(client, owner, repo, label);
                core.debug(`Label: ${label.name} has been deleted on ${owner}/${repo}`);
            }
        }

        // Create and/or Update Labels
        for (const desiredLabel of desiredLabels) {
            let indexOfLabel = currentLabels.findIndex(l => l.name == desiredLabel.name);
            if (indexOfLabel == -1) {
                await createLabel(client, owner, repo, desiredLabel);
                core.debug(`Label: ${desiredLabel.name} has been created on ${owner}/${repo}`);
            } else if (currentLabels[indexOfLabel].description != desiredLabel.description || currentLabels[indexOfLabel].color != desiredLabel.color) {
                await updateLabel(client, owner, repo, desiredLabel);
                core.debug(`Label: ${desiredLabel.name} has been updated on ${owner}/${repo}`);
            }

            core.debug(`Label: ${desiredLabel.name} has not been changed on ${owner}/${repo}`);
        }
    } catch (error) {
        core.error(error);
        core.setFailed(error.message);
    }
}

async function getConfiguration(client: InstanceType<typeof GitHub>, configurationPath: string): Promise<Label[]> {
    const configurationContent = await fetchContent(client, configurationPath);

    const configObject: any = yaml.load(configurationContent);
    return configObject.labels as Label[];
}

async function fetchContent(client: InstanceType<typeof GitHub>, repoPath: string): Promise<string> {
    const response = await client.repos.getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: repoPath,
        ref: context.sha
    });

    response.data

    return Buffer.from((response.data as any).content, (response.data as any).encoding).toString();
}

async function getLabels(client: InstanceType<typeof GitHub>, owner: string, repo: string): Promise<Label[]> {
    let labels: Label[] = new Array<Label>();

    let page: number = 0;
    while (true) {
        const response = await client.issues.listLabelsForRepo({
            owner: owner,
            repo: repo,
            per_page: 100
        });

        for (let label of response.data) {
            labels.push({
                name: label.name,
                description: label.description == null ? undefined : label.description,
                color: label.color
            });
        }

        if (response.data.length !== 100) {
            break;
        }

        page += 1;
    }

    return labels;
}

async function createLabel(client: InstanceType<typeof GitHub>, owner: string, repo: string, label: Label): Promise<void> {
    client.issues.createLabel({
        owner: owner,
        repo: repo,
        name: label.name,
        description: label.description,
        color: label.color
    });
}

async function updateLabel(client: InstanceType<typeof GitHub>, owner: string, repo: string, label: Label): Promise<void> {
    client.issues.updateLabel({
        owner: owner,
        repo: repo,
        name: label.name,
        description: label.description,
        color: label.color
    });
}

async function deleteLabel(client: InstanceType<typeof GitHub>, owner: string, repo: string, label: Label): Promise<void> {
    client.issues.deleteLabel({
        owner: owner,
        repo: repo,
        name: label.name
    });
}

run();
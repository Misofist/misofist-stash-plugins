const QUERY_DUPLICATE_SCENES = `
query {
    findDuplicateScenes(distance: 4, duration_diff: 2) {
        id
        files {
            id
            path
            basename
            parent_folder {
                id
            }
        }
    }
}
`;

interface DuplicateScenesResultScene {
    id: string;
    files: Array<{
        id: string;
        path: string;
        basename: string;
        parent_folder: {
            id
        }
    }>;
}

interface DuplicateScenesResult {
    findDuplicateScenes: Array<Array<DuplicateScenesResultScene>>;
};

const MUTATION_MOVE_FILES = `
mutation MoveFiles($fileIds: [ID!]!, $destination_folder: String, $destination_folder_id: ID, $destination_basename: String) {
    moveFiles(input: {
        ids: $fileIds,
        destination_folder: $destination_folder,
        destination_folder_id: $destination_folder_id,
        destination_basename: $destination_basename,
    })
}
`;

interface MoveFilesVariables extends GraphQLDefaultInputVariables {
    fileIds: Array<string>;
    destination_folder?: string;
    destination_folder_id?: string;
    destination_basename?: string;
}

interface MoveFilesResults {
    moveFiles: boolean;
}

const MUTATION_DELETE_SCENE = `
mutation DeleteScene($sceneId: ID!) {
    sceneDestroy(input: {
        id: $sceneId,
        delete_file: false,
        delete_generated: true,
    })
}
`;

interface DeleteSceneVariables extends GraphQLDefaultInputVariables {
    sceneId: string;
}

interface DeleteSceneResults {
    sceneDestroy: boolean;
}

const MUTATION_ASSIGN_FILE_TO_SCENE = `
mutation AssignFileToScene($fileId: ID!, $sceneId: ID!) {
    sceneAssignFile(input: {
        scene_id: $sceneId,
        file_id: $fileId,
    })
}
`;

interface AssignFileToSceneInput extends GraphQLDefaultInputVariables {
    sceneId: string;
    fileId: string;
}

interface AssignFileToSceneResults {
    sceneAssignFile: boolean;
}

const MUTATION_SET_SCENE_PRIMARY_FILE = `
mutation SetScenePrimaryFile($sceneId: ID!, $fileId: ID!) {
    sceneUpdate(input: {
        id: $sceneId,
        primary_file_id: $fileId,
    }) {
        id
    }
}
`;

interface SetScenePrimaryFileInput {
    sceneId: string;
    fileId: string;
}

interface SetScenePrimaryFileResults {
    sceneUpdate: {
        id: string;
    }
}

const MUTATION_DELETE_FILES = `
mutation DeleteFiles($fileIds: [ID!]!) {
    deleteFiles(ids: $fileIds)
}
`;

interface DeleteFilesInput {
    fileIds: Array<string>;
}

interface DeleteFilesResults {
    deleteFiles: boolean;
}

type NoArguments = {[key: string]: never};


// This is gross, but this was the only way I could find to see if a file still exists on the filesystem.
function doesFileExist(file: {id, basename, parent_folder: {id: string}}): boolean {
    const originalBasename = file.basename;
    const tempBasename = `temp-${originalBasename}`;
    try {
        const tempMoveResult = gql.Do(MUTATION_MOVE_FILES, <MoveFilesVariables>{
            fileIds: [file.id],
            destination_folder_id: file.parent_folder.id,
            destination_basename: tempBasename,
        });
    }
    catch(ex) {
        if(`${ex}`.indexOf("no such file or directory") !== -1) {
            return false;
        }
        throw ex;
    }
    gql.Do(MUTATION_MOVE_FILES, <MoveFilesVariables>{
        fileIds: [file.id],
        destination_folder_id: file.parent_folder.id,
        destination_basename: originalBasename,
    });
    return true;
}

function getFileNameWithoutExtension(basename: string): string {
    const lastDotIndex = basename.lastIndexOf(".");
    if(lastDotIndex === -1) {
        return "";
    }
    return basename.substring(0, lastDotIndex);
}

function main() {
    const mode = input.Args.mode;

    try {
        switch(mode) {
            case "fix":
                fixScenesWithModifiedExtensions();
                break;
            default:
                log.Error(`Unknown mode ${mode}`);
                break;
        }
    } catch (ex: unknown) {
        log.Error(`${ex}`);
        return;
    }
}

function fixScenesWithModifiedExtensions() {
    const duplicateScenesResult = gql.Do<NoArguments, DuplicateScenesResult>(QUERY_DUPLICATE_SCENES);
    const duplicateSceneSets = duplicateScenesResult.findDuplicateScenes;

    log.Info(`Scanning ${duplicateSceneSets.length} duplicate scenes`);
    for(let i = 0; i < duplicateSceneSets.length; i++) {
        const duplicateSceneSet = duplicateSceneSets[i];
        log.Progress(i / duplicateSceneSets.length);
        log.Debug(`Scanning duplicate set ${duplicateSceneSet[0].files[0].basename}`)

        if(duplicateSceneSet.length != 2) {
            log.Debug(`Duplicate set contains more than 2 scenes (${duplicateSceneSet.length}), skipping.`);
            continue;
        }

        const sceneA = duplicateSceneSet[0];
        const sceneB = duplicateSceneSet[1];
        if(sceneA.files.length != 1 || sceneB.files.length != 1) {
            log.Debug(`At least one scene contains more than 1 file, skipping.`);
            continue;
        }

        const fileA = sceneA.files[0];
        const fileB = sceneB.files[0];
        if(getFileNameWithoutExtension(fileA.path) !== getFileNameWithoutExtension(fileB.path)) {
            log.Debug(`File paths without extensions do not match, skipping. ("${fileA.path}" != "${fileB.path}")`);
            continue;
        }

        const fileAExists = doesFileExist(fileA);
        const fileBExists = doesFileExist(fileB);
        if(fileAExists && fileBExists) {
            log.Debug(`Both files still exist, skipping.`);
            continue;
        }
        if(!fileAExists && !fileBExists) {
            log.Debug(`Neither file exists, skipping.`);
            continue;
        }

        const existingScene = fileAExists ? sceneA : sceneB;
        const missingScene = fileAExists ? sceneB : sceneA;

        log.Debug(`Match found! Fixing.`);
        gql.Do(MUTATION_DELETE_SCENE, <DeleteSceneVariables>{sceneId: existingScene.id});
        gql.Do(MUTATION_ASSIGN_FILE_TO_SCENE, <AssignFileToSceneInput>{sceneId: missingScene.id, fileId: existingScene.files[0].id});
        gql.Do(MUTATION_SET_SCENE_PRIMARY_FILE, <SetScenePrimaryFileInput>{sceneId: missingScene.id, fileId: existingScene.files[0].id});
        gql.Do(MUTATION_DELETE_FILES, <DeleteFilesInput>{fileIds: [missingScene.files[0].id]});

        log.Info(`Match found! Renamed from ${missingScene.files[0].basename} to ${existingScene.files[0].basename}`);
    }

    log.Info("Finished!");

    return <PluginOutput<null>>{};
}

main();
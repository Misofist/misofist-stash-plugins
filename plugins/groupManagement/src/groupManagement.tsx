(function() {
    const pluginAPI = window.PluginApi as IPluginAPI;
    const React = pluginAPI.React;
    const ReactDOM = pluginAPI.ReactDOM;
    const { faArrowTurnUp } = pluginAPI.libraries.FontAwesomeSolid;
    const { Icon } = pluginAPI.components;

    // Because of the way that we inject React components outside of where we're
    // really supposed to be putting them, we need to store some references to
    // various parts of the page's state where we can easily retrieve them.
    // I'm sure there's a neater way to do this using Portals but this works.
    interface PageContext {
        intl: any;
        createGroup: any;
        updateScenesBulk: any;
        scenesUpdate: any;
        toast: any;
        groupId: any;
    }
    let currentPageContext: PageContext;

    const selectedScenes: Array<any> = []; // gross but idk how else to do this
    let selectedScenesUpdateListener = () => {};

    const visibleScenes: {[sceneId: string]: any} = {};

    pluginAPI.patch.instead("SceneCard.Overlays", function (props, _, Original) {
        console.log(props);
        return (
            <>
                <Original {...props} />
                <PromoteSceneInfoToGroupOverlay scene={props.scene} fromGroupId={props.fromGroupId} />
                <SceneListingExtensionInjector selected={props.selected} scene={props.scene} fromGroupId={props.fromGroupId} />
            </>
        );
    });


    const PromoteSceneInfoToGroupOverlay: React.FC<{
        scene: any;
        fromGroupId: string;
    }> = ({ scene, fromGroupId }) => {
        const groupId = fromGroupId;

        if (!groupId) {
            return <></>;
        }

        const useGroupUpdate = pluginAPI.utils.StashService.useGroupUpdate;
        const [updateGroup, { loading: updating }] = useGroupUpdate();

        const promoteSceneInfoToGroup = (evt: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
            const previewImageElement = (evt.currentTarget.parentElement as HTMLDivElement).querySelector(".scene-card-preview-image") as HTMLImageElement;

            var canvas = document.createElement("canvas");
            canvas.width = previewImageElement.naturalWidth;
            canvas.height = previewImageElement.naturalHeight;
            const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;  
            ctx.drawImage(previewImageElement, 0, 0);

            console.log(scene);
            updateGroup({
                variables: {
                    input: {
                        id: groupId,
                        name: scene.title || scene.files[0].path.replace(/^.*\//, "").replace(/\..*$/, ""),
                        aliases: scene.code,
                        date: scene.date,
                        studio_id: scene.studio?.id,
                        director: scene.director,
                        synopsis: scene.details,
                        urls: scene.urls,
                        tag_ids: scene.tags.map(t => t.id),
                        front_image: canvas.toDataURL(),
                    },
                },
            });
        };

        return (
            <span className="group-management-promote-info" title="Promote Scene Info to Group" onClick={promoteSceneInfoToGroup}>
                <Icon icon={faArrowTurnUp}></Icon>
            </span>
        );
    };


    const moreMenuClicked = (evt: MouseEvent) => {
        window.setTimeout(() => {
            const operationsMenu = document.querySelector<HTMLDivElement>('.dropdown-menu[aria-labelledby="more-menu"]');

            if(!operationsMenu) {
                return;
            }

            const alreadyInjected = operationsMenu.querySelector<HTMLDivElement>(".group-management-extensions");
            if(alreadyInjected) {
                return;
            }
            
            const container = document.createElement("div");
            container.classList.add("group-management-extensions");
            ReactDOM.render(<SceneListingOperationsMenuExtensions operationsMenu={operationsMenu} />, container);
            operationsMenu.appendChild(container);
        }, 1);
    };

    const SceneListingExtensionInjector: React.FC<{
        selected: boolean,
        scene: any,
        fromGroupId: string,
    }> = ({selected, scene, fromGroupId}) => {

        currentPageContext = {
            intl: pluginAPI.libraries.Intl.useIntl(),
            createGroup: pluginAPI.utils.StashService.useGroupCreate()[0],
            updateScenesBulk: pluginAPI.utils.StashService.useBulkSceneUpdate()[0],
            scenesUpdate: pluginAPI.utils.StashService.useScenesUpdate()[0],
            toast: pluginAPI.hooks.useToast(),
            groupId: fromGroupId,
        };

        React.useEffect(() => {
            visibleScenes[scene.id] = scene;
            return () => {
                delete visibleScenes[scene.id];
            }
        })

        window.setTimeout(() => {
            const operationsMenuButton = document.querySelector<HTMLDivElement>("#more-menu");

            if(selected) {
                if(!selectedScenes.find(s => s.id === scene.id)) {
                    selectedScenes.push(scene);
                    selectedScenesUpdateListener();
                }
            } else {
                const sceneIndex = selectedScenes.findIndex(s => s.id === scene.id);
                if(sceneIndex != -1) {
                    selectedScenes.splice(sceneIndex, 1);
                    selectedScenesUpdateListener();
                }
            }
            if(!operationsMenuButton) {
                return;
            }

            operationsMenuButton.addEventListener("click", moreMenuClicked);
        }, 1);

        return (<></>);
    };

    const SceneListingOperationsMenuExtensions: React.FC<{
        operationsMenu: HTMLDivElement,
    }> = ({operationsMenu}) => {
        // In case the route has changed and the user's selection has been cleared, empty the existing selected items list
        const createGroupFromScenes = (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
            const firstSelectedScene = selectedScenes[0];

            const thumbnailPath = firstSelectedScene.paths.screenshot;

            fetch(thumbnailPath)
            .then(r => r.blob())
            .then(blob => {
                return new Promise(resolve => {
                    let reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                })
            }).then(thumbnailDataUrl => currentPageContext.createGroup({
                variables: {
                    input: {
                        name: firstSelectedScene.title || firstSelectedScene.files[0].path.replace(/^.*\//, "").replace(/\..*$/, ""),
                        aliases: firstSelectedScene.code,
                        date: firstSelectedScene.date,
                        studio_id: firstSelectedScene.studio?.id,
                        director: firstSelectedScene.director,
                        synopsis: firstSelectedScene.details,
                        urls: firstSelectedScene.urls,
                        tag_ids: firstSelectedScene.tags.map((t: {id: string}) => t.id),
                        front_image: thumbnailDataUrl,
                    }
                },
            }))
            .then(result => {
                const groupId = result.data?.groupCreate?.id;
                if (groupId) {
                    return currentPageContext.updateScenesBulk({
                        variables: {
                            input: {
                                ids: selectedScenes.map(s => s.id),
                                group_ids: {
                                    mode: "ADD",
                                    ids: [groupId],
                                }
                            } 
                        }
                    }).then(() => groupId);
                }
            }).then((groupId) => {
                selectNoneButton?.click();
                const stopProp = (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => evt.stopPropagation();
                currentPageContext.toast.success(
                    <>
                        Group created: <a href={`/groups/${groupId}`} onClick={stopProp}>VIEW</a>
                    </>
                );
            });

            evt.preventDefault();
            document.body.click(); // close menu
        }

        const autonumberScenes = (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
            evt.preventDefault();
            document.body.click(); // close menu

            const scenesToModify = new Set((selectedScenes.length > 0 ? selectedScenes : Object.values(visibleScenes)).map(s => s.id));

            const sortedScenes = Array.from(Object.values(visibleScenes)).sort((a, b) => a.files[0].path.localeCompare(b.files[0].path, undefined, { numeric: true }));

            const sceneUpdates: Array<any> = [];
            for(let i = 0; i < sortedScenes.length; i++) {
                const scene = sortedScenes[i];
                
                if(scenesToModify.has(scene.id)) {
                    sceneUpdates.push({
                        id: scene.id,
                        groups: scene.groups.map(g => {
                            return {
                                group_id: g.group.id,
                                scene_index: g.group.id == currentPageContext.groupId ? i+1 : g.scene_index,
                            };
                        })
                    });
                }
            }

            currentPageContext.scenesUpdate({
                variables: {
                    input: sceneUpdates,
                }
            }).then(result => {
                currentPageContext.toast.success(
                    <>
                        Successfully updated {result.count} scenes
                    </>
                );
            });
        }

        const selectNoneText = currentPageContext.intl.formatMessage({ id: "actions.select_none" });
        const selectNoneButton = (Array.from(operationsMenu.children) as Array<HTMLAnchorElement>).find((c) => c.innerText.includes(selectNoneText));
        selectNoneButton?.addEventListener("click", () => {
            // Items that are no longer visible can still be selected.
            // If "Select None" is clicked we need to clear these too.
            // Fortunately "Select All" only selects visible items.
            selectedScenes.length = 0;
            selectedScenesUpdateListener();
        });

        React.useEffect(() => {
            // Clear the scene selection when the user navigates away from the listing page
            return () => {
                selectedScenes.length = 0;
            };
        }, []);

        const createGroupFromScenesButton = React.useRef<HTMLAnchorElement>(null);

        selectedScenesUpdateListener = () => {
            const buttonElm = createGroupFromScenesButton.current;
            if(!buttonElm) {
                return;
            }
            if(selectedScenes.length > 0) {
                buttonElm.style.display = "block";
            } else {
                buttonElm.style.display = "none";
            }
        };

        return <>
            <a
                ref={createGroupFromScenesButton}
                style={{display: selectedScenes.length > 0 ? "block" : "none"}}
                href="#"
                className="bg-secondary text-white dropdown-item"
                role="button"
                onClick={createGroupFromScenes}
            >
                Create Group From Selected Scenes
            </a>
            {
                currentPageContext.groupId ? (
                    <a
                        href="#"
                        className="bg-secondary text-white dropdown-item"
                        role="button"
                        onClick={autonumberScenes}
                    >
                        Set scene numbers based on path alphabetical order
                    </a>
                ) : <></>
            }
        </>;
    };
})();
// SPDX-License-Identifier: MIT
// Copyright (c) 2022 The Pybricks Authors

import './installPybricksDialog.scss';
import {
    Button,
    Callout,
    Checkbox,
    Classes,
    Code,
    Collapse,
    ControlGroup,
    DialogStep,
    FormGroup,
    Icon,
    InputGroup,
    Intent,
    MenuItem,
    MultistepDialog,
    NonIdealState,
    Pre,
    Spinner,
    Switch,
} from '@blueprintjs/core';
import { Classes as Classes2, Popover2 } from '@blueprintjs/popover2';
import { Select2 } from '@blueprintjs/select';
import { FirmwareMetadata, HubType } from '@pybricks/firmware';
import { fileOpen } from 'browser-fs-access';
import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import { useLocalStorage } from 'usehooks-ts';
import { alertsShowAlert } from '../../alerts/actions';
import {
    appName,
    pybricksUsbDfuWindowsDriverInstallUrl,
    pybricksUsbLinuxUdevRulesUrl,
} from '../../app/constants';
import HelpButton from '../../components/HelpButton';
import {
    Hub,
    hubBootloaderType,
    hubHasBluetoothButton,
    hubHasExternalFlash,
    hubHasUSB,
} from '../../components/hubPicker';
import { HubPicker } from '../../components/hubPicker/HubPicker';
import { useHubPickerSelectedHub } from '../../components/hubPicker/hooks';
import { FileMetadata } from '../../fileStorage';
import { useFileStorageMetadata } from '../../fileStorage/hooks';
import { useSelector } from '../../reducers';
import { ensureError } from '../../utils';
import ExternalLinkIcon from '../../utils/ExternalLinkIcon';
import { isLinux, isWindows } from '../../utils/os';
import {
    firmwareInstallPybricksDialogAccept,
    firmwareInstallPybricksDialogCancel,
} from './actions';
import { useCustomFirmware, useFirmware } from './hooks';
import { useI18n } from './i18n';
import { validateHubName } from '.';

const dialogBody = classNames(
    Classes.DIALOG_BODY,
    'pb-firmware-installPybricksDialog-body',
);

/** Translates hub type from firmware metadata to local hub type. */
function getHubTypeFromMetadata(
    metadata: FirmwareMetadata | undefined,
    fallback: Hub,
): Hub {
    switch (metadata?.['device-id']) {
        case HubType.MoveHub:
            return Hub.Move;
        case HubType.CityHub:
            return Hub.City;
        case HubType.TechnicHub:
            return Hub.Technic;
        case HubType.PrimeHub:
            return Hub.Prime;
        case HubType.EssentialHub:
            return Hub.Essential;
        default:
            return fallback;
    }
}

function getHubTypeNameFromMetadata(metadata: FirmwareMetadata | undefined): string {
    switch (metadata?.['device-id']) {
        case HubType.MoveHub:
            return 'BOOST Move Hub';
        case HubType.CityHub:
            return 'City Hub';
        case HubType.TechnicHub:
            return 'Technic Hub';
        case HubType.PrimeHub:
            return 'SPIKE Prime/MINDSTORMS Robot Inventor hub';
        case HubType.EssentialHub:
            return 'SPIKE Essential hub';
        default:
            return '?';
    }
}

const UnsupportedHubs: React.VoidFunctionComponent = () => {
    const i18n = useI18n();

    return (
        <div className={Classes.RUNNING_TEXT}>
            <h4>
                {i18n.translate('selectHubPanel.notOnListButton.info.mindstorms.title')}
            </h4>
            <ul>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.rcx',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.nxt',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.ev3',
                    )}
                </li>
            </ul>
            <h4>
                {i18n.translate('selectHubPanel.notOnListButton.info.poweredUp.title')}
            </h4>
            <ul>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.wedo2',
                    )}
                    <em>*</em>
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.duploTrain',
                    )}
                    <em>*</em>
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.mario',
                    )}
                </li>
            </ul>

            <em>
                *{' '}
                {i18n.translate(
                    'selectHubPanel.notOnListButton.info.poweredUp.footnote',
                )}
            </em>
        </div>
    );
};

type SelectHubPanelProps = {
    customFirmwareZip: File | undefined;
    onCustomFirmwareZip: (firmwareZip: File | undefined) => void;
};

const SelectHubPanel: React.VoidFunctionComponent<SelectHubPanelProps> = ({
    customFirmwareZip,
    onCustomFirmwareZip,
}) => {
    const { isCustomFirmwareRequested, customFirmwareData } =
        useCustomFirmware(customFirmwareZip);
    const [isAdvancedOpen, setIsAdvancedOpen] = useLocalStorage(
        'installPybricksDialog.isAdvancedOpen',
        false,
    );
    const i18n = useI18n();
    const dispatch = useDispatch();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        // should only be one file since multiple={false}
        acceptedFiles.forEach((f) => {
            onCustomFirmwareZip(f);
        });
    }, []);

    const onClick = useCallback(async () => {
        try {
            const file = await fileOpen({
                id: 'customFirmware',
                mimeTypes: ['application/zip'],
                extensions: ['.zip'],
                // TODO: translate description
                description: 'Zip Files',
                excludeAcceptAllOption: true,
                startIn: 'downloads',
            });

            onCustomFirmwareZip(file);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // user cancelled, nothing to do
            } else {
                dispatch(
                    alertsShowAlert('alerts', 'unexpectedError', {
                        error: ensureError(err),
                    }),
                );
            }
        }
    }, []);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }

            e.stopPropagation();
            onClick();
        },
        [onClick],
    );

    const { getRootProps, getInputProps } = useDropzone({
        accept: { 'application/zip': ['.zip'] },
        multiple: false,
        // react-dropzone doesn't allow full control of File System API, so we
        // implement our own using browser-fs-access instead.
        noClick: true,
        onDrop,
    });

    return (
        <div className={dialogBody}>
            {isCustomFirmwareRequested ? (
                <>
                    <p>{i18n.translate('selectHubPanel.customFirmware.message')}</p>
                    <p>
                        {i18n.translate('selectHubPanel.customFirmware.hubType', {
                            hubTypeName: getHubTypeNameFromMetadata(
                                customFirmwareData?.metadata,
                            ),
                        })}
                    </p>
                    <p>
                        {i18n.translate(
                            'selectHubPanel.customFirmware.firmwareVersion',
                            {
                                version:
                                    customFirmwareData?.metadata['firmware-version'],
                            },
                        )}
                    </p>
                    <Button
                        onClick={() => {
                            onCustomFirmwareZip(undefined);
                        }}
                    >
                        {i18n.translate('selectHubPanel.customFirmware.clearButton')}
                    </Button>
                </>
            ) : (
                <>
                    <p>{i18n.translate('selectHubPanel.message')}</p>
                    <HubPicker />
                    <Popover2
                        popoverClassName={Classes2.POPOVER2_CONTENT_SIZING}
                        placement="right-end"
                        content={<UnsupportedHubs />}
                        renderTarget={({ isOpen: _isOpen, ref, ...targetProps }) => (
                            <Button
                                elementRef={ref as React.Ref<HTMLButtonElement>}
                                {...targetProps}
                            >
                                {i18n.translate('selectHubPanel.notOnListButton.label')}
                            </Button>
                        )}
                    />
                </>
            )}
            <div className="pb-firmware-installPybricksDialog-selectHub-advanced">
                <Button
                    minimal={true}
                    small={true}
                    icon={isAdvancedOpen ? 'chevron-down' : 'chevron-right'}
                    onClick={() => setIsAdvancedOpen((v) => !v)}
                >
                    {i18n.translate('selectHubPanel.advanced.label')}
                </Button>
                <Collapse isOpen={isAdvancedOpen}>
                    <div
                        {...getRootProps({
                            className: 'pb-dropzone-root',
                            onClick,
                            onKeyDown,
                        })}
                    >
                        <input {...getInputProps()} />
                        {i18n.translate(
                            'selectHubPanel.advanced.customFirmwareDropzone.label',
                        )}
                    </div>
                </Collapse>
            </div>
        </div>
    );
};

type AcceptLicensePanelProps = {
    hubType: Hub;
    licenseAccepted: boolean;
    customFirmwareZip: File | undefined;
    onLicenseAcceptedChanged: (accepted: boolean) => void;
};

const AcceptLicensePanel: React.VoidFunctionComponent<AcceptLicensePanelProps> = ({
    hubType,
    licenseAccepted,
    customFirmwareZip,
    onLicenseAcceptedChanged,
}) => {
    const { firmwareData, firmwareError } = useFirmware(hubType);
    const { isCustomFirmwareRequested, customFirmwareData, customFirmwareError } =
        useCustomFirmware(customFirmwareZip);
    const i18n = useI18n();

    const selectedFirmwareData = isCustomFirmwareRequested
        ? customFirmwareData
        : firmwareData;
    const selectedFirmwareError = isCustomFirmwareRequested
        ? customFirmwareError
        : firmwareError;

    return (
        <div className={dialogBody}>
            <div className="pb-firmware-installPybricksDialog-license-text">
                {selectedFirmwareData ? (
                    <Pre>{selectedFirmwareData.licenseText}</Pre>
                ) : (
                    <NonIdealState
                        icon={selectedFirmwareError ? 'error' : <Spinner />}
                        description={
                            selectedFirmwareError
                                ? i18n.translate('licensePanel.licenseText.error')
                                : undefined
                        }
                    />
                )}
            </div>
            <Checkbox
                className="pb-firmware-installPybricksDialog-license-checkbox"
                label={i18n.translate('licensePanel.acceptCheckbox.label')}
                checked={licenseAccepted}
                onChange={(e) => onLicenseAcceptedChanged(e.currentTarget.checked)}
                disabled={!selectedFirmwareData}
            />
        </div>
    );
};

type SelectOptionsPanelProps = {
    hubType: Hub;
    hubName: string;
    includeProgram: boolean;
    selectedIncludeFile: FileMetadata | undefined;
    onChangeHubName(hubName: string): void;
    onChangeIncludeProgram(includeProgram: boolean): void;
    onChangeSelectedIncludeFile(selectedIncludeFile: FileMetadata | undefined): void;
};

const ConfigureOptionsPanel: React.VoidFunctionComponent<SelectOptionsPanelProps> = ({
    hubType,
    hubName,
    includeProgram,
    selectedIncludeFile,
    onChangeHubName,
    onChangeIncludeProgram,
    onChangeSelectedIncludeFile,
}) => {
    const i18n = useI18n();
    const isHubNameValid = validateHubName(hubName);
    const files = useFileStorageMetadata();

    return (
        <div className={dialogBody}>
            <FormGroup
                label={i18n.translate('optionsPanel.hubName.label')}
                labelInfo={i18n.translate('optionsPanel.hubName.labelInfo')}
            >
                <ControlGroup>
                    <InputGroup
                        value={hubName}
                        onChange={(e) => onChangeHubName(e.currentTarget.value)}
                        onMouseOver={(e) => e.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                        intent={isHubNameValid ? Intent.NONE : Intent.DANGER}
                        placeholder="Pybricks Hub"
                        rightElement={
                            isHubNameValid ? undefined : (
                                <Icon
                                    icon="error"
                                    intent={Intent.DANGER}
                                    itemType="div"
                                />
                            )
                        }
                    />
                    <HelpButton
                        helpForLabel={i18n.translate('optionsPanel.hubName.label')}
                        content={i18n.translate('optionsPanel.hubName.help')}
                    />
                </ControlGroup>
            </FormGroup>
            <FormGroup
                label={i18n.translate('optionsPanel.customMain.label')}
                labelInfo={i18n.translate('optionsPanel.customMain.labelInfo')}
            >
                {(hubHasExternalFlash(hubType) && (
                    <p>
                        {i18n.translate(
                            'optionsPanel.customMain.notApplicable.message',
                        )}
                    </p>
                )) || (
                    <ControlGroup>
                        <Switch
                            labelElement={i18n.translate(
                                'optionsPanel.customMain.include.label',
                                { main: <Code>main.py</Code> },
                            )}
                            checked={includeProgram}
                            onChange={(e) =>
                                onChangeIncludeProgram(
                                    (e.target as HTMLInputElement).checked,
                                )
                            }
                        />
                        <Select2
                            items={files || []}
                            itemRenderer={(
                                item,
                                { handleClick, handleFocus, modifiers },
                            ) => (
                                <MenuItem
                                    roleStructure="listoption"
                                    active={modifiers.active}
                                    disabled={modifiers.disabled}
                                    text={item.path}
                                    key={item.uuid}
                                    onClick={handleClick}
                                    onFocus={handleFocus}
                                />
                            )}
                            noResults={
                                <MenuItem
                                    roleStructure="listoption"
                                    disabled={true}
                                    text={i18n.translate(
                                        'optionsPanel.customMain.include.noFiles',
                                    )}
                                />
                            }
                            filterable={false}
                            popoverProps={{ minimal: true }}
                            disabled={!includeProgram}
                            onItemSelect={onChangeSelectedIncludeFile}
                        >
                            <Button
                                icon="double-caret-vertical"
                                text={
                                    selectedIncludeFile?.path ??
                                    i18n.translate(
                                        'optionsPanel.customMain.include.noSelection',
                                    )
                                }
                                disabled={!includeProgram}
                            />
                        </Select2>
                        <HelpButton
                            helpForLabel={i18n.translate(
                                'optionsPanel.customMain.include.label',
                                { main: 'main.py' },
                            )}
                            content={i18n.translate(
                                'optionsPanel.customMain.include.help',
                                {
                                    appName,
                                },
                            )}
                        />
                    </ControlGroup>
                )}
            </FormGroup>
        </div>
    );
};

type BootloaderModePanelProps = {
    hubType: Hub;
};

const BootloaderModePanel: React.VoidFunctionComponent<BootloaderModePanelProps> = ({
    hubType,
}) => {
    const i18n = useI18n();

    const { button, light, lightPattern } = useMemo(() => {
        return {
            button: i18n.translate(
                hubHasBluetoothButton(hubType)
                    ? 'bootloaderPanel.button.bluetooth'
                    : 'bootloaderPanel.button.power',
            ),
            light: i18n.translate(
                hubHasBluetoothButton(hubType)
                    ? 'bootloaderPanel.light.bluetooth'
                    : 'bootloaderPanel.light.status',
            ),
            lightPattern: i18n.translate(
                hubHasBluetoothButton(hubType)
                    ? 'bootloaderPanel.lightPattern.bluetooth'
                    : 'bootloaderPanel.lightPattern.status',
            ),
        };
    }, [i18n, hubType]);

    return (
        <div className={dialogBody}>
            {hubHasUSB(hubType) && isLinux() && (
                <Callout intent={Intent.WARNING} icon="warning-sign">
                    {i18n.translate('bootloaderPanel.warning.linux')}{' '}
                    <a
                        href={pybricksUsbLinuxUdevRulesUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {i18n.translate('bootloaderPanel.warning.learnMore')}
                    </a>
                    <ExternalLinkIcon />
                </Callout>
            )}
            {hubHasUSB(hubType) && isWindows() && (
                <Callout intent={Intent.WARNING} icon="warning-sign">
                    {i18n.translate('bootloaderPanel.warning.windows')}{' '}
                    <a
                        href={pybricksUsbDfuWindowsDriverInstallUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {i18n.translate('bootloaderPanel.warning.learnMore')}
                    </a>
                    <ExternalLinkIcon />
                </Callout>
            )}

            <div className={Classes.RUNNING_TEXT}>
                <p>{i18n.translate('bootloaderPanel.instruction1')}</p>
                <ol>
                    {hubHasUSB(hubType) && (
                        <li>{i18n.translate('bootloaderPanel.step.disconnectUsb')}</li>
                    )}

                    <li>{i18n.translate('bootloaderPanel.step.powerOff')}</li>

                    {/* City hub has power issues and requires disconnecting motors/sensors */}
                    {hubType === Hub.City && (
                        <li>{i18n.translate('bootloaderPanel.step.disconnectIo')}</li>
                    )}

                    <li>
                        {i18n.translate('bootloaderPanel.step.holdButton', { button })}
                    </li>

                    {hubHasUSB(hubType) && (
                        <li>{i18n.translate('bootloaderPanel.step.connectUsb')}</li>
                    )}

                    <li>
                        {i18n.translate('bootloaderPanel.step.waitForLight', {
                            button,
                            light,
                            lightPattern,
                        })}
                    </li>

                    <li>
                        {i18n.translate(
                            /* hubs with USB will keep the power on, but other hubs won't */
                            hubHasUSB(hubType)
                                ? 'bootloaderPanel.step.releaseButton'
                                : 'bootloaderPanel.step.keepHolding',
                            {
                                button,
                            },
                        )}
                    </li>
                </ol>
                <p>
                    {i18n.translate('bootloaderPanel.instruction2', {
                        flashFirmware: (
                            <strong>
                                {i18n.translate('flashFirmwareButton.label')}
                            </strong>
                        ),
                    })}
                </p>
            </div>
        </div>
    );
};

export const InstallPybricksDialog: React.VoidFunctionComponent = () => {
    const { isOpen } = useSelector((s) => s.firmware.installPybricksDialog);
    const dispatch = useDispatch();
    const [hubName, setHubName] = useState('');
    const [includeProgram, setIncludeProgram] = useState(false);
    const [selectedIncludeFile, setSelectedIncludeFile] = useState<FileMetadata>();
    const [licenseAccepted, setLicenseAccepted] = useState(false);
    const [hubType] = useHubPickerSelectedHub();
    const { firmwareData } = useFirmware(hubType);
    const [customFirmwareZip, setCustomFirmwareZip] = useState<File>();
    const { isCustomFirmwareRequested, customFirmwareData } =
        useCustomFirmware(customFirmwareZip);
    const i18n = useI18n();

    const selectedFirmwareData = isCustomFirmwareRequested
        ? customFirmwareData
        : firmwareData;
    const selectedHubType = isCustomFirmwareRequested
        ? getHubTypeFromMetadata(customFirmwareData?.metadata, hubType)
        : hubType;

    return (
        <MultistepDialog
            title={i18n.translate('title')}
            isOpen={isOpen}
            onClose={() => dispatch(firmwareInstallPybricksDialogCancel())}
            finalButtonProps={{
                text: i18n.translate('flashFirmwareButton.label'),
                onClick: () =>
                    dispatch(
                        firmwareInstallPybricksDialogAccept(
                            hubBootloaderType(selectedHubType),
                            selectedFirmwareData?.firmwareZip ?? new ArrayBuffer(0),
                            selectedIncludeFile?.path,
                            hubName,
                        ),
                    ),
            }}
        >
            <DialogStep
                id="hub"
                title={i18n.translate('selectHubPanel.title')}
                panel={
                    <SelectHubPanel
                        customFirmwareZip={customFirmwareZip}
                        onCustomFirmwareZip={setCustomFirmwareZip}
                    />
                }
                nextButtonProps={{ text: i18n.translate('nextButton.label') }}
            />
            <DialogStep
                id="license"
                title={i18n.translate('licensePanel.title')}
                panel={
                    <AcceptLicensePanel
                        hubType={selectedHubType}
                        licenseAccepted={licenseAccepted}
                        customFirmwareZip={customFirmwareZip}
                        onLicenseAcceptedChanged={setLicenseAccepted}
                    />
                }
                backButtonProps={{ text: i18n.translate('backButton.label') }}
                nextButtonProps={{
                    disabled: !licenseAccepted,
                    text: i18n.translate('nextButton.label'),
                }}
            />
            <DialogStep
                id="options"
                title={i18n.translate('optionsPanel.title')}
                panel={
                    <ConfigureOptionsPanel
                        hubType={selectedHubType}
                        hubName={hubName}
                        includeProgram={includeProgram}
                        selectedIncludeFile={selectedIncludeFile}
                        onChangeHubName={setHubName}
                        onChangeIncludeProgram={setIncludeProgram}
                        onChangeSelectedIncludeFile={setSelectedIncludeFile}
                    />
                }
                backButtonProps={{ text: i18n.translate('backButton.label') }}
                nextButtonProps={{ text: i18n.translate('nextButton.label') }}
            />
            <DialogStep
                id="bootloader"
                title={i18n.translate('bootloaderPanel.title')}
                panel={<BootloaderModePanel hubType={selectedHubType} />}
                backButtonProps={{ text: i18n.translate('backButton.label') }}
            />
        </MultistepDialog>
    );
};

// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2021 The Pybricks Authors

import React from 'react';
import { useDispatch } from 'react-redux';
import { BleConnectionState } from '../ble/reducers';
import { BootloaderConnectionState } from '../lwp3-bootloader/reducers';
import * as notificationActions from '../notifications/actions';
import { useSelector } from '../reducers';
import OpenFileButton, { OpenFileButtonProps } from '../toolbar/OpenFileButton';
import { TooltipId } from '../toolbar/i18n';
import { flashFirmware } from './actions';
import firmwareIcon from './firmware.svg';

type FlashButtonProps = Pick<OpenFileButtonProps, 'id'>;

const FlashButton: React.FunctionComponent<FlashButtonProps> = (props) => {
    const bootloaderConnection = useSelector((s) => s.bootloader.connection);
    const bleConnection = useSelector((s) => s.ble.connection);
    const flashing = useSelector((s) => s.firmware.flashing);
    const progress = useSelector((s) => s.firmware.progress);

    const dispatch = useDispatch();

    return (
        <OpenFileButton
            fileExtension=".zip"
            icon={firmwareIcon}
            tooltip={flashing ? TooltipId.FlashProgress : TooltipId.Flash}
            enabled={
                bootloaderConnection === BootloaderConnectionState.Disconnected &&
                bleConnection === BleConnectionState.Disconnected
            }
            showProgress={flashing}
            progress={progress === null ? undefined : progress}
            onFile={(data) => dispatch(flashFirmware(data))}
            onReject={(file) =>
                dispatch(
                    notificationActions.add(
                        'error',
                        `'${file.name}' is not a valid firmware file.`,
                    ),
                )
            }
            onClick={() => dispatch(flashFirmware(null))}
            {...props}
        />
    );
};

export default FlashButton;

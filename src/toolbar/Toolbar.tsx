// SPDX-License-Identifier: MIT
// Copyright (c) 2020-2022 The Pybricks Authors

import { ButtonGroup } from '@blueprintjs/core';
import React from 'react';
import { useId } from 'react-aria';
import { Toolbar as UtilsToolbar } from '../components/toolbar/Toolbar';
import BluetoothButton from './buttons/bluetooth/BluetoothButton';
import ReplButton from './buttons/repl/ReplButton';
import RunButton from './buttons/run/RunButton';
import StopButton from './buttons/stop/StopButton';
import TourButton from './buttons/tour/TourButton';

import './toolbar.scss';

// matches ID in tour component
const bluetoothButtonId = 'pb-toolbar-bluetooth-button';
const runButtonId = 'pb-toolbar-run-button';
const tourButtonId = 'pb-toolbar-tour-button';

const Toolbar: React.VFC = () => {
    const flashButtonId = useId();
    const stopButtonId = useId();
    const replButtonId = useId();

    return (
        <UtilsToolbar className="pb-toolbar" firstFocusableItemId={flashButtonId}>
            <ButtonGroup className="pb-toolbar-group pb-align-left">
                <BluetoothButton id={bluetoothButtonId} />
            </ButtonGroup>
            <ButtonGroup className="pb-toolbar-group pb-align-left">
                <RunButton id={runButtonId} />
                <StopButton id={stopButtonId} />
                <ReplButton id={replButtonId} />
            </ButtonGroup>
            <ButtonGroup className="pb-toolbar-group pb-align-right">
                <TourButton id={tourButtonId} />
            </ButtonGroup>
        </UtilsToolbar>
    );
};

export default Toolbar;

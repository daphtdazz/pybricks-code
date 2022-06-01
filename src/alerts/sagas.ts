// SPDX-License-Identifier: MIT
// Copyright (c) 2022 The Pybricks Authors

import { IToaster } from '@blueprintjs/core';
import { eventChannel } from 'redux-saga';
import { delay, getContext, put, take, takeEvery } from 'typed-redux-saga/macro';
import { getAlertProps } from '../alerts';
import { alertsDidShowAlert, alertsShowAlert } from './actions';

export type AlertsSagaContext = { toaster: IToaster };

/** Shows an alert to the user and avoids duplicate alerts. */
function* handleShowAlert(action: ReturnType<typeof alertsShowAlert>): Generator {
    const toaster = yield* getContext<IToaster>('toaster');

    const key = `${action.domain}.${action.specific}.${JSON.stringify(action.props)}`;

    const existing = toaster.getToasts().filter((t) => t.key === key);

    // if a toast with the same parameters is already open, close it so we
    // can open it again without duplicates.
    if (existing.length > 0) {
        toaster.dismiss(key);
        yield* delay(500);
    }

    const chan = eventChannel<string>((emit) => {
        const props = getAlertProps(action.domain, action.specific, emit, action.props);
        toaster.show(props, key);

        // have to return an unsubscribe function to not break things
        return () => undefined;
    });

    try {
        const alertAction = yield* take(chan);

        yield* put(alertsDidShowAlert(action.domain, action.specific, alertAction));
    } finally {
        chan.close();
    }
}

export default function* (): Generator {
    yield* takeEvery(alertsShowAlert, handleShowAlert);
}
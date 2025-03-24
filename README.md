# anocm [^1] (Anonymous Chat-Messenger)

An anonymous memory-only chat platform.

## Overview

**_anocm_** (Anonymous Chat-Messenger) is an open-source messaging application designed with a focus on anonymity, security, and non-persistence. Unlike traditional messaging apps, **_anocm_** aims to address privacy concerns by not storing messages persistently and offering features that ensure users' identities and message content remain private.

This project is part of a _university project_ undertaken by a group of students for 'ITP-PROJEKT' at UAS Technikum Wien.

## Problem Statement

Current messaging applications face several privacy issues, including:

- **Persistent message storage**: Messages are stored in databases, which may be accessed by third parties through backdoors or other means.
- **User identification** Messages are stored in databases, which may be accessed by third parties through backdoors or other means.
- **Data collection**: Even if it's only telemetry data, many messengers collect and sell user data to third parties.
  These issues put user privacy and anonymity at risk.

## Solution

**_anocm_** aims to solve these problems with the following key features:

1. **Non-persistent message storage**: Messages are only stored in memory and will not persist afte the conversation ends.
2. **End-to-end encryption**: All messages are encrypted before they are sent. Users control their encryption keys, and **_anocm_** never has access to them.
3. **No registration**: Users can join the service as an anonymous "guest" without the need to create an account, ensuring no identifiable trace is left behind.
4. **Customizable message retention**: Users can specify the duration for which their messages are stored (if at all).
5. **Open-source**: The project is open-source, ensuring transparency and trust.

## Technical Environment:

- **Server**: simple low-throughput server
- **Backend**: Express (Node/JavaScript)
- **Database**: RedisDB
- **Frontend**: Pure JavaScript/Typescript (or libraries like react)
- **Design**: scss/tailwind/bootstrap
- **Project Management**: GitHub (Repo and Project)

[^1]: _This project is part of our **university** curriculum. (ITP-project application)_

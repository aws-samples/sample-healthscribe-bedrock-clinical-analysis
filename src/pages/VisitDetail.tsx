// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { ReactNode, useState } from 'react';
import { CustomAppLayout } from '../components/commons/common-components';
import { VisitContainer } from '../components/commons/visit-container'; 

import '../styles/base.scss';
import '../styles/top-navigation.scss';

export function Visit() {

  return (
    <>
      <CustomAppLayout
        stickyNotifications
        toolsHide
        navigationHide = {true}
        content={<VisitContainer />}
      />
    </>
  );
}
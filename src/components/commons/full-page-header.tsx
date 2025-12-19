// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import Button from '@cloudscape-design/components/button';
import Header, { HeaderProps } from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { InfoLink } from './info-link';
import {useTranslation} from 'react-i18next';

interface FullPageHeaderProps extends HeaderProps {
  title?: string;
  createButtonText?: string;
  extraActions?: React.ReactNode;
  selectedItemsCount?: number;
  onInfoLinkClick?: () => void;
}

export function FullPageHeader({
  title = 'Distributions',
  createButtonText = 'Create distribution',
  extraActions = null,
  selectedItemsCount,
  onInfoLinkClick,
  ...props
}: FullPageHeaderProps) {
  const { t } = useTranslation();
  const isOnlyOneSelected = selectedItemsCount === 1;

  return (
    <Header
      variant="awsui-h1-sticky"
      info={onInfoLinkClick && <InfoLink onFollow={onInfoLinkClick} />}
      actions={
        <SpaceBetween size="xs" direction="horizontal">
          {extraActions}
          <Button data-testid="header-btn-view-details" disabled={!isOnlyOneSelected}>
            {t("ui.buttons.viewDetails")}
          </Button>
          <Button data-testid="header-btn-edit" disabled={!isOnlyOneSelected}>
            {t("ui.buttons.edit")}
          </Button>
          <Button data-testid="header-btn-delete" disabled={selectedItemsCount === 0}>
            {t("ui.buttons.delete")}
          </Button>
          <Button data-testid="header-btn-create" variant="primary">
            {createButtonText}
          </Button>
        </SpaceBetween>
      }
      {...props}
    >
      {title}
    </Header>
  );
}
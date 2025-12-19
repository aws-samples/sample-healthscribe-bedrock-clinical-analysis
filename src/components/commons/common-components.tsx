// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { forwardRef } from 'react';

import AppLayout, { AppLayoutProps } from '@cloudscape-design/components/app-layout';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en.json';
import SpaceBetween from '@cloudscape-design/components/space-between';
import LiveTranscription from '../components/LiveTranscription';
import { useTranslation } from 'react-i18next';

// backward compatibility
export * from './index';

export const ec2NavItems = [
  { type: 'link', text: 'Instances', href: '#/instances' },
  { type: 'link', text: 'Instance types', href: '#/instance-types' },
  { type: 'link', text: 'Launch templates', href: '#/launch-templates' },
  { type: 'link', text: 'Spot requests', href: '#/spot-requests' },
  { type: 'link', text: 'Saving plans', href: '#/saving-plans' },
  { type: 'link', text: 'Reserved instances', href: '#/reserved-instances' },
  { type: 'divider' },
  {
    type: 'link',
    text: 'Notifications',
    info: <Badge color="red">23</Badge>,
    href: '#/notifications',
  },
  {
    type: 'link',
    text: 'Documentation',
    external: true,
    href: '#/documentation',
  },
] as const;

export const TableNoMatchState = ({ onClearFilter }: { onClearFilter: () => void }) => {
  const { t } = useTranslation();
  return (
    <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
      <SpaceBetween size="xxs">
        <div>
          <b>{t('data.table.noMatches')}</b>
          <Box variant="p" color="inherit">
            {t('data.table.cantFindMatch')}
          </Box>
        </div>
        <Button onClick={onClearFilter}>{t('ui.buttons.clearFilter')}</Button>
      </SpaceBetween>
    </Box>
  );
};

export const TableEmptyState = ({ resourceName }: { resourceName: string }) => {
  const { t } = useTranslation();
  return (
    <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
      <SpaceBetween size="xxs">
        <div>
          <b>No {resourceName.toLowerCase()}s</b>
          <Box variant="p" color="inherit">
            No {resourceName.toLowerCase()}s associated with this resource.
          </Box>
        </div>
        <Button>{t('ui.buttons.create')} {resourceName.toLowerCase()}</Button>
      </SpaceBetween>
    </Box>
  );
};

export const CustomAppLayout = forwardRef<AppLayoutProps.Ref, AppLayoutProps>(function CustomAppLayout(props, ref) {
  return (
    <I18nProvider locale="en" messages={[enMessages]}>
      <AppLayout ref={ref} {...props} />
    </I18nProvider>
  );
});
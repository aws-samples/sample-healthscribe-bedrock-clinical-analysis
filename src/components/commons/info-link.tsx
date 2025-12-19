// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import Link, { LinkProps } from '@cloudscape-design/components/link';
import {useTranslation} from 'react-i18next';

interface InfoLinkProps {
  id?: string;
  ariaLabel?: string;
  onFollow: LinkProps['onFollow'];
}
export const InfoLink = (props: InfoLinkProps) => {
  const { t } = useTranslation();
  
  return (
    <Link variant="info" {...props}>
      {t("ui.accessibility.info")}
    </Link>
  );
};
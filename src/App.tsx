// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Patient } from './pages/PatientDetail';
import { useLocation } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';
import { useEffect } from 'react';
import { getAllPatients } from './services/patientService';
import Link from '@cloudscape-design/components/link';
import LiveTranscription from './components/LiveTranscription';
import {useTranslation} from 'react-i18next';

import Box from '@cloudscape-design/components/box';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Table, { TableProps } from '@cloudscape-design/components/table';
import TopNavigation from '@cloudscape-design/components/top-navigation';

import { isVisualRefresh } from './common/apply-mode';
import { CustomAppLayout } from './components/commons/common-components';
import asclepiusLogo from './assets/asclepiusLogo.png';
import { AuthHeader } from './components/auth/auth-header.tsx'

import './styles/base.scss';
import './styles/top-navigation.scss';
import './styles/auth.scss'
import { CreatePatient } from './pages/CreatePatient';
import { getCurrentUser } from 'aws-amplify/auth';
import { Visit } from './pages/VisitDetail.tsx';
import Wizard from './pages/Wizard.tsx';
import './i18n';

const useNavItems = () => {
  const { t } = useTranslation();
  return [
    {
      type: 'section',
      text: t('navigation.menu.manage'),
      items: [
        { type: 'link', text: t('navigation.menu.patients'), href: '/' },
      ],
    },
    {
      type: 'section',
      text: t('navigation.menu.setUp'),
      items: [
        { type: 'link', text: t('navigation.menu.database'), href: '#/database' },
        { type: 'link', text: t('navigation.menu.authentication'), href: '#/authentication' },
        { type: 'link', text: t('navigation.menu.analytics'), href: '#/analytics' },
        { type: 'link', text: t('navigation.menu.predictions'), href: '#/predictions' },
        { type: 'link', text: t('navigation.menu.interactions'), href: '#/interactions' },
        { type: 'link', text: t('navigation.menu.notifications'), href: '#/notifications' },
      ],
      defaultExpanded: false
    },
  ];
};

const usePatientNavItems = () => {
  const { t } = useTranslation();
  return [
    {
      type: 'section',
      text: t('navigation.menu.manage'),
      items: [
        { type: 'link', text: t('navigation.menu.home'), href: '/' },
        { type: 'link', text: t('navigation.menu.carePlan'), href: '#/patients' },
        { type: 'link', text: t('navigation.menu.riskCalculation'), href: '#/patients' },
      ],
    },
  ];
};

const usePatientBreadcrumbs = () => {
  const { t } = useTranslation();
  return [
    {
      text: t('app.general.name'),
      href: '/',
    },
    {
      text: t('navigation.menu.patients'),
      href: '/',
    },
    {
      text: t('navigation.breadcrumbs.patientDetail'),
      href: '/patient/:patientID',
    },
  ];
};

const useVisitBreadcrumbs = () => {
  const { t } = useTranslation();
  return [
    {
      text: t('app.general.name'),
      href: '/',
    },
    {
      text: t('navigation.menu.patients'),
      href: '/',
    },
    {
      text: t('navigation.breadcrumbs.visitDetail'),
      href: '/visit/:visitID',
    },
  ];
};

const useBreadcrumbs = () => {
  const { t } = useTranslation();
  return [
    {
      text: t('app.general.name'),
      href: '/',
    },
    {
      text: t('navigation.menu.patients'),
      href: '#',
    },
  ];
};

const useI18nStrings = () => {
  const { t } = useTranslation();
  return {
    searchIconAriaLabel: t('ui.accessibility.searchIconAriaLabel'),
    searchDismissIconAriaLabel: t('ui.accessibility.searchDismissIconAriaLabel'),
    overflowMenuTriggerText: t('ui.accessibility.overflowMenuTriggerText'),
    overflowMenuTitleText: t('ui.accessibility.overflowMenuTitleText'),
    overflowMenuBackIconAriaLabel: t('ui.accessibility.overflowMenuBackIconAriaLabel'),
    overflowMenuDismissIconAriaLabel: t('ui.accessibility.overflowMenuDismissIconAriaLabel'),
  };
};

interface Item {
  patientID: string;
  firstName: string;
  lastName: string;
  dob: string;
}



const Content = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);

  const columnDefinitions: TableProps.ColumnDefinition<Item>[] = [
    {
      id: 'name',
      cell: item => (
        <Link 
          onFollow={() => navigate(`/patient/${item.patientID}`)}
          href={`/patient/${item.patientID}`}
        >
          {`${item.firstName} ${item.lastName}`}
        </Link>
      ),
      header: t('ui.fields.name'),
      minWidth: 100,
      isRowHeader: true,
    },
    {
      id: 'patientID',
      header: t('ui.fields.patientId'),
      cell: item => item.patientID,
      minWidth: 80,
    },
    {
      id: 'dob',
      header: t('ui.fields.dateOfBirth'),
      cell: item => item.dob,
      minWidth: 80,
    },
  ];

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        await getCurrentUser();
        const data = await getAllPatients();
        setPatients(data);
      } catch (error) {
        console.error("Failed to fetch patients:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const handlePatientClick = (item: Item) => {
    navigate(`/patient/${item.patientID}`);
  };

  return (
    <Box padding={{ top: isVisualRefresh ? 's' : 'n' }}>
      <Table
        items={patients}
        columnDefinitions={columnDefinitions}
        loading={loading}
        loadingText={t('data.table.loadingPatients')}
        selectionType="single"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => 
          setSelectedItems(detail.selectedItems)
        }
        onRowClick={({ detail }) => handlePatientClick(detail.item)}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={`(${patients.length})`}
            actions={
              <SpaceBetween size="xs" direction="horizontal">
                <Button variant="primary" onClick={() => navigate('/createPatient')}>{t('ui.buttons.createPatientProfile')}</Button>
              </SpaceBetween>
            }
          >
            {t('navigation.menu.patients')}
          </Header>
        }
        stickyHeader={true}
        empty={
          <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
            <SpaceBetween size="xxs">
              <div>
                <b>{t('data.table.noPatients')}</b>
                <Box variant="p" color="inherit">
                  {t('data.table.noPatientsDescription')}
                </Box>
              </div>
              <Button onClick={() => navigate('/createPatient')}>{t('ui.buttons.createPatientProfile')}</Button>
            </SpaceBetween>
          </Box>
        }
        enableKeyboardNavigation={true}
      />
    </Box>
  );
};

interface DemoHeaderPortalProps {
  children: ReactNode;
}

const DemoHeaderPortal = ({ children }: DemoHeaderPortalProps) => {
  const domNode = document.querySelector('#h')!;
  return createPortal(children, domNode);
};

Amplify.configure(outputs);

export function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const isPatientDetail = location.pathname.includes('/patient/');
  const isVisitDetail = location.pathname.includes('/visit/');
  const [searchValue, setSearchValue] = useState('');
  const [navigationOpen, setNavigationOpen] = useState(false);
  
  const navItems = useNavItems();
  const patientNavItems = usePatientNavItems();
  const patientBreadcrumbs = usePatientBreadcrumbs();
  const visitBreadcrumbs = useVisitBreadcrumbs();
  const breadcrumbs = useBreadcrumbs();
  const i18nStrings = useI18nStrings();

  return (
    <Authenticator.Provider>
      
      <Authenticator
        className="custom-authenticator"
        variation="modal"
        components={{
          Header: AuthHeader
        }}>
        {({ signOut, user}) => (

        
      <>
        <DemoHeaderPortal>
          <TopNavigation
            i18nStrings={i18nStrings}
            identity={{
              href: '/',
              title: t('app.general.name'),
              logo: {
                src: asclepiusLogo,
                alt: t('app.general.name') + ' Logo',
              },
            }}
            utilities={[{
              type: 'button',
              iconName: 'notification',
              ariaLabel: t('ui.accessibility.notificationAriaLabel'),
              badge: true,
              disableUtilityCollapse: true,
            },
            { type: 'button', iconName: 'settings', title: t('ui.accessibility.settings'), ariaLabel: t('ui.accessibility.settingsAriaLabel') },
            {
              type: 'menu-dropdown',
              text: t('user.profile.exampleUser'),
              description: t('user.profile.exampleEmail'),
              iconName: 'user-profile',
              items: [
                { id: 'profile', text: t('user.profile.profile') },
                { id: 'preferences', text: t('user.profile.preferences') },
                { id: 'security', text: t('user.profile.security') },
                {
                  id: 'support-group',
                  text: t('user.support.support'),
                  items: [
                    {
                      id: 'documentation',
                      text: t('user.support.documentation'),
                      href: '#',
                      external: true,
                      externalIconAriaLabel: t('user.support.opensInNewTab'),
                    },
                    { id: 'feedback', text: t('user.support.feedback'), href: '#', external: true, externalIconAriaLabel: t('user.support.opensInNewTab') },
                    { id: 'support', text: t('user.support.customerSupport') },
                  ],
                },
                { id: 'signout', text: t('user.profile.signOut')},
              ],
              onItemClick: (event) => {
                if (event.detail.id === 'signout') {
                  signOut();
                }
              }
            }
          ]}
          />
        </DemoHeaderPortal>
        <CustomAppLayout
          stickyNotifications
          toolsHide
          navigation={
            <SideNavigation 
              activeHref="#/pages" 
              items={isPatientDetail ? patientNavItems : navItems}
              header={{text: isPatientDetail ? t('patient.general.title') : t('navigation.menu.home')}}
            />
          }
          navigationOpen={navigationOpen}
          onNavigationChange={({detail}) => setNavigationOpen(detail.open)}
          breadcrumbs={<BreadcrumbGroup 
            items={
              isPatientDetail 
                ? patientBreadcrumbs 
                : isVisitDetail 
                  ? visitBreadcrumbs 
                  : breadcrumbs
            } 
            expandAriaLabel={t('navigation.breadcrumbs.showPath')} 
            ariaLabel={t('navigation.breadcrumbs.ariaLabel')} />}
          content={
            <Routes>
              <Route path="/" element={<Content />} />
              <Route path="/patient/:patientID" element={<Patient />} />
              <Route path="/createPatient/" element={<CreatePatient />} /> 
              <Route path="/visit/:visitID" element={<Visit />} />
              <Route path="/patients/:patientID/new-visit" element={<Wizard></Wizard>} />
            </Routes>}
        />
      </>
      )}
      
      </Authenticator>
    </Authenticator.Provider>
  );
}
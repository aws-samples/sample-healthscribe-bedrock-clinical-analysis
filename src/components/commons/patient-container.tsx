import * as React from "react";
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import Container from "@cloudscape-design/components/container";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import { ConsentModal } from "./modal";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import { getPatientById, Patient } from "../../services/patientService";
import { ContentLayout } from "@cloudscape-design/components";
import { VisitListContent } from "./visit-list";
import LiveTranscription from '../components/LiveTranscription';
import {useTranslation} from 'react-i18next';


export function patientContainer() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { patientID } = useParams<{ patientID: string }>();

  const navigate = useNavigate();


  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientID) {
        setError(t('patient.states.noIdProvided'));
        setLoading(false);
        return;
      }

      try {
        const patientData = await getPatientById(patientID);
        if (patientData) {
          setPatient(patientData);
        } else {
          setError(t('patient.states.notFound'));
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
        setError(t('patient.states.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientID]);

  return (
<ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            description={t('patient.general.information')}
          >
            {patient ? `${patient.firstName} ${patient.lastName}` : t('patient.general.details')}
          </Header>
        </SpaceBetween>
      }
    >
      {loading ? (
        <Container>
          <Box padding="l">{t('patient.states.loading')}</Box>
        </Container>
      ) : error ? (
        <Container>
          <Box padding="l">{error}</Box>
        </Container>
      ) : !patient ? (
        <Container>
          <Box padding="l">{t('patient.states.notFound')}</Box>
        </Container>
      ) : (
        <SpaceBetween size="l">
          <Container variant="stacked"
          >
            <SpaceBetween size="m">
              <Box>
                <SpaceBetween size="s">
                <KeyValuePairs
                  columns={3}
                  items={[
                    { label: t('ui.fields.patientId'), value: patient.patientID },
                    { label: t('ui.fields.dob'), value: patient.dob }
                  ]}
                />
                  
                </SpaceBetween>
              </Box>
            </SpaceBetween>
          </Container>

          <Container
            header={
              <Header
                variant="h2"
                description={t('patient.general.clickToStartRecording')}
                actions={
                  <SpaceBetween
                    direction="horizontal"
                    size="xs"
                  >
                    <Button variant="primary" onClick={() => setVisible(true)}>{t('ui.buttons.begin')}</Button>

                    <Modal
                      onDismiss={() => setVisible(false)}
                      visible={visible}
                      footer={
                        <Box float="right">
                          <SpaceBetween direction="horizontal" size="xs">
                            <Button variant="link" onClick={() => setVisible(false)}>
                              {t('ui.buttons.cancel')}
                            </Button>
                            <Button variant="primary"
                              onClick={() => {
                                setVisible(true);
                                navigate(`/patients/${patientID}/new-visit`);}}>
                              {t('ui.buttons.confirmed')}
                            </Button>
                          </SpaceBetween>
                        </Box>
                      }
                      header={<React.Fragment>{t('ui.headers.recordingConsent')}</React.Fragment>}
                    >
                      {t('session.actions.advisePatient')}
                    </Modal>

                  </SpaceBetween>
                }
              >
                {t('patient.general.startNewVisit')}
              </Header>
            }
          >
          </Container>

        {/* Additional patient information containers can be added here */}
        <Container
            header={
              <Header variant="h2">{t('ui.headers.medicalHistory')}</Header>
            }
          >
            <Box padding="l">
              {/* Add medical history content here */}
              {t('patient.general.medicalHistoryInfo')}
            </Box>
          </Container>

       

          {/* Add previous visits history as a table, with each record clickable and leads into detailed visit view */}
          <VisitListContent patientId={patient.patientID} />
      

        </SpaceBetween>

        
      )}
    </ContentLayout>

  );
}

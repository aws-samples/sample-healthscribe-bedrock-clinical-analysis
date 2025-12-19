import * as React from "react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useState } from "react";
import Container from "@cloudscape-design/components/container";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Header from "@cloudscape-design/components/header";
import Table from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import { ConsentModal } from "./modal";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import { getPatientById, Patient } from "../../services/patientService";
import { getVisitById, Visit } from "../../services/visitService";
import { ContentLayout } from "@cloudscape-design/components";
import { BreadcrumbGroup } from "@cloudscape-design/components";
import LiveTranscription from '../components/LiveTranscription';
import {useTranslation} from 'react-i18next';


export function VisitContainer() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { visitID } = useParams<{ visitID: string }>();
  console.log("URL Parameter visitID:", visitID)


  useEffect(() => {
    const fetchVisitData = async () => {
      if (!visitID) {
        setError(t('visit.states.noIdProvided'));
        setLoading(false);
        return;
      }

      try {
        const visitData = await getVisitById(visitID);
        if (visitData) {
          setVisit(visitData);
        } else {
          setError(t('visit.states.notFound'));
        }
      } catch (err) {
        console.error('Error fetching visit details:', err);
        setError(t('visit.states.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchVisitData();
  }, [visitID]);

  // const breadcrumbItems = [
  //   { text: 'Patients', href: '/' },
  //   { text: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient Details', href: '#' },
  // ];

  return (
<ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            description={t('visit.general.records')}
          >
            {visit ? ` ${visit.date}` : t('visit.general.title')}
          </Header>
        </SpaceBetween>
      }
    >
      {loading ? (
        <Container>
          <Box padding="l">{t('visit.states.loading')}</Box>
        </Container>
      ) : error ? (
        <Container>
          <Box padding="l">{error}</Box>
        </Container>
      ) : !visit ? (
        <Container>
          <Box padding="l">{t('visit.states.notFound')}</Box>
        </Container>
      ) : (
        <SpaceBetween size="l">
          <Container variant="stacked">
            <SpaceBetween size="m">
              <KeyValuePairs
                columns={2}
                items={[
                  { label: t('ui.fields.patientId'), value: visit.patientID }
                ]}
              />
            </SpaceBetween>
          </Container>

          <Container
            header={<Header variant="h2">{t('medical.soap.note')}</Header>}
          >
            <SpaceBetween size="m">
              <Container
                header={<Header variant="h3">{t('medical.soap.subjective')}</Header>}
              >
                <KeyValuePairs
                  columns={1}
                  items={[
                    { label: t('medical.soap.chiefComplaint'), value: visit.soapNote.subjective.chiefComplaint },
                    { label: t('medical.soap.historyOfPresentIllness'), value: visit.soapNote.subjective.historyOfPresentIllness }
                  ]}
                />
              </Container>

              <Container
                header={<Header variant="h3">{t('medical.soap.objective')}</Header>}
              >
                <KeyValuePairs
                  columns={1}
                  items={[
                    { label: t('medical.soap.objective'), value: visit.soapNote.objective }
                  ]}
                />
              </Container>

              <Container
                header={<Header variant="h3">{t('medical.soap.assessment')}</Header>}
              >
                <KeyValuePairs
                  columns={1}
                  items={[
                    { label: t('medical.soap.primaryDiagnosis'), value: visit.soapNote.assessment.primaryDiagnosis.condition },
                    { label: t('medical.soap.primaryDiagnosisICD10'), value: visit.soapNote.assessment.primaryDiagnosis.icd10 },
                    { label: t('medical.soap.secondaryDiagnosis'), value: visit.soapNote.assessment.secondaryDiagnosis.condition },
                    { label: t('medical.soap.secondaryDiagnosisICD10'), value: visit.soapNote.assessment.secondaryDiagnosis.icd10 }
                  ]}
                />
              </Container>

              <Container
                header={<Header variant="h3">{t('medical.soap.plan')}</Header>}
              >
                <KeyValuePairs
                  columns={1}
                  items={[
                    { label: t('medical.soap.treatment'), value: visit.soapNote.plan.treatment },
                    { label: t('medical.soap.followup'), value: visit.soapNote.plan.followUp }
                  ]}
                />
              </Container>

            </SpaceBetween>
          </Container>
        </SpaceBetween>
      )}
    </ContentLayout>

  );
}

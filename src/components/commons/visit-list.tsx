import * as React from "react";
import { useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useState } from "react";
import Header from "@cloudscape-design/components/header";
import Table, { TableProps } from "@cloudscape-design/components/table";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Box from "@cloudscape-design/components/box";
import Link from '@cloudscape-design/components/link';
import { getCurrentUser } from 'aws-amplify/auth';
import { getAllVisits, getVisitsByPatientId } from "../../services/visitService";
import { isVisualRefresh } from '../../common/apply-mode';
import {useTranslation} from 'react-i18next';

interface Item {
    visitID: string;
    date: string;
    patientID: string;
    soapNote: string;
    summaryFile: string;
  }

interface VisitListContentProps {
    patientId?: string;
}

export function VisitListContent({ patientId }: VisitListContentProps) {
    const navigate = useNavigate();
    const [visits, setVisits] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<Item[]>([]);
    const { t } = useTranslation();

    const columnDefinitions: TableProps.ColumnDefinition<Item>[] = [
      {
        id: 'name',
        cell: item => (
          <Link 
            onFollow={() => navigate(`/visit/${item.visitID}`)}
            href={`/visit/${item.visitID}`}
          >
            {`${item.date}`}
          </Link>
        ),
        header: t('visit.general.title'),
        minWidth: 100,
        isRowHeader: true,
      },
      {
        id: 'visitID',
        header: t('ui.fields.visitId'),
        cell: item => item.visitID,
        minWidth: 80,
      },
    ];
  
    useEffect(() => {
      const fetchVisits = async () => { 
        try {
          await getCurrentUser();
          let data;
        if (patientId) {
        // If patientId is provided, fetch visits for that patient
        data = await getVisitsByPatientId(patientId);
        } else {
        // Otherwise, fetch all visits (existing behavior)
        data = await getAllVisits();
        }
          setVisits(data);
        } catch (error) {
          console.error("Failed to fetch visits:", error);
          // You might want to add error handling here
        } finally {
          setLoading(false);
        }
      };
  
      fetchVisits();
    }, [patientId]);
  
    const handleVisitClick = (item: Item) => {
      navigate(`/visit/${item.visitID}`);
    };
  
    return (
      <Box padding={{ top: isVisualRefresh ? 's' : 'n' }}>
        <Table
          items={visits}
          columnDefinitions={columnDefinitions}
          loading={loading}
          loadingText={t('data.table.loadingVisits')}
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => 
            setSelectedItems(detail.selectedItems)
          }
          onRowClick={({ detail }) => handleVisitClick(detail.item)}
          header={
            <Header
              variant="h2"
              counter={`(${visits.length})`}
            //   actions={
            //     // <SpaceBetween size="xs" direction="horizontal">
            //     //   <Button disabled>View details</Button>
            //     //   <Button disabled>Edit</Button>
            //     //   <Button disabled>Delete</Button>
            //     //   <Button variant="primary" onClick={() => navigate('/createPatient')}>Create new visit</Button> 
            //     //   {/* might take the last line out */}
            //     // </SpaceBetween>
            //   }
            >
              {patientId ? t('visit.general.patientVisits') : t('visit.general.allVisits')}
            </Header>
          }
          stickyHeader={true}
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="xxs">
                <div>
                  <b>{t("data.table.noVisits")}</b>
                  <Box variant="p" color="inherit">
                  {patientId ? 
                    t("visit.states.noPatientVisits") :
                    t("visit.states.noVisitsFound")
                  }
                  </Box>
                </div>

              </SpaceBetween>
            </Box>
          }
          enableKeyboardNavigation={true}
        />
      </Box>
    );
  };
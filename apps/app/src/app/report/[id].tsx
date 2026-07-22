import { useLocalSearchParams, useRouter } from 'expo-router'

import { ReportDetail } from '@/components/report/report-detail'

export default function ReportDetailRoute() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const reportId = Array.isArray(id) ? id[0] : id
  const returnToReports = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/reports')
    }
  }
  const returnAfterDelete = () => router.dismissTo('/reports')

  return (
    <ReportDetail
      reportId={reportId ?? ''}
      onBack={returnToReports}
      onDeleted={returnAfterDelete}
    />
  )
}

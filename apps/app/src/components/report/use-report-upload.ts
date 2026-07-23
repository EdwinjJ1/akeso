import type {
  HealthReport,
  ReportExtractionResult,
  ReportImageUpload,
} from '@akeso/domain'
import * as DocumentPicker from 'expo-document-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppState } from '@/state/app-state'
import { resizeForRecognition } from '@/state/fridge-image'
import {
  addManualMetricCandidate,
  candidatesFromExtraction,
  editMetricCandidate,
  hasInvalidConfirmedCandidates,
  removeMetricCandidate,
  toConfirmedReportMetrics,
  toggleMetricCandidate,
  type ReportMetricCandidate,
} from '@/state/report-flow'

import { demoReportExtraction } from './report-demo'
import { formatBytes, useMountedRef, wait, type SelectedFile } from './report-ui'

/**
 * All state and async handlers for the upload → extract → review → save flow.
 *
 * Two guards protect every async entry point (camera, photos, PDF, demo,
 * retry, save):
 * - `busyRef` is set synchronously on entry, so a second tap — even in the
 *   same frame, or while a native picker is open before `working` flips —
 *   can never start a concurrent extraction that would race for the same
 *   state and mismatch the shown file and the shown metrics.
 * - `mounted` is checked after every await, so navigating away mid-flow
 *   never calls setState on an unmounted component.
 */
export function useReportUpload() {
  const {
    extractReportMetrics,
    getReports,
    saveReport,
    deleteReport,
    getReportRecommendations,
    regenerateReportRecommendations,
  } = useAppState()

  const mounted = useMountedRef()
  const busyRef = useRef(false)

  const [reports, setReports] = useState<HealthReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [candidates, setCandidates] = useState<ReportMetricCandidate[]>([])
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [retryImage, setRetryImage] = useState<ReportImageUpload | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reportName, setReportName] = useState('Blood test report')
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [savedNotice, setSavedNotice] = useState(false)

  const refreshReports = useCallback(async () => {
    setLoadingReports(true)
    setListError(null)
    try {
      const next = await getReports()
      if (mounted.current) setReports(next)
    } catch (error) {
      if (mounted.current) {
        setListError(
          error instanceof Error ? error.message : 'Could not load your reports.'
        )
      }
    } finally {
      if (mounted.current) setLoadingReports(false)
    }
  }, [getReports, mounted])

  useEffect(() => {
    void refreshReports()
  }, [refreshReports])

  /**
   * Wraps an async entry point: rejects re-entry while any flow task is
   * running, and always releases the guard — including when the component
   * unmounted mid-task (busyRef survives remounts of the same closure only).
   */
  const runExclusive = async (task: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await task()
    } finally {
      busyRef.current = false
    }
  }

  const applyExtractionResult = (result: ReportExtractionResult) => {
    setCandidates(candidatesFromExtraction(result))
    setSavedNotice(false)
    if (result.status === 'empty') {
      setMessage(
        result.reason === 'unrecognizable_image'
          ? 'This file is too unclear to read. Try another file or add metrics manually.'
          : 'No test metrics were detected. You can still add them manually.'
      )
    } else if (result.status === 'refused') {
      setMessage(
        'This file could not be processed. Manual entry is still available.'
      )
    } else {
      setMessage(
        'Review every field. Nothing is saved or used for advice until you confirm it.'
      )
    }
  }

  const extractProcessedImage = async (image: ReportImageUpload) => {
    try {
      const result = await extractReportMetrics(image)
      if (!mounted.current) return
      setRetryImage(null)
      applyExtractionResult(result)
    } catch (error) {
      if (!mounted.current) return
      setRetryImage(image)
      setMessage(
        error instanceof Error
          ? error.message
          : 'Extraction failed. Your file is still here, so you can retry.'
      )
    }
  }

  const extractAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    source: 'camera' | 'photo'
  ) => {
    setWorking(true)
    setMessage(null)
    setRetryImage(null)
    setSavedNotice(false)
    setSelectedFile({
      name: asset.fileName ?? `health-report-${Date.now()}.jpg`,
      source,
      sizeLabel: formatBytes(asset.fileSize),
      detail: 'JPG image · 1 page',
    })
    try {
      const resize = resizeForRecognition(asset.width, asset.height)
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize ? [{ resize }] : [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      )
      if (!mounted.current) return
      setPreviewUri(processed.uri)
      await extractProcessedImage({
        uri: processed.uri,
        filename: `report-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      })
    } catch (error) {
      if (!mounted.current) return
      setMessage(
        error instanceof Error ? error.message : 'Could not process the image.'
      )
    } finally {
      if (mounted.current) setWorking(false)
    }
  }

  const retryExtraction = () =>
    runExclusive(async () => {
      if (!retryImage) return
      setWorking(true)
      setMessage(null)
      try {
        await extractProcessedImage(retryImage)
      } finally {
        if (mounted.current) setWorking(false)
      }
    })

  const openCamera = () =>
    runExclusive(async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!mounted.current) return
        if (!permission.granted) {
          setMessage(
            'Camera permission was denied. Use photos, PDF, or manual entry instead.'
          )
          return
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 1,
        })
        if (!mounted.current) return
        if (!result.canceled) await extractAsset(result.assets[0], 'camera')
      } catch (error) {
        if (!mounted.current) return
        setMessage(
          error instanceof Error ? error.message : 'Could not open the camera.'
        )
      }
    })

  const openLibrary = () =>
    runExclusive(async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          quality: 1,
        })
        if (!mounted.current) return
        if (!result.canceled) await extractAsset(result.assets[0], 'photo')
      } catch (error) {
        if (!mounted.current) return
        setMessage(
          error instanceof Error ? error.message : 'Could not open photos.'
        )
      }
    })

  const openPdf = () =>
    runExclusive(async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: true,
          multiple: false,
        })
        if (!mounted.current || result.canceled) return
        const asset = result.assets[0]
        setSelectedFile({
          name: asset.name,
          source: 'pdf',
          sizeLabel: formatBytes(asset.size),
          detail: 'PDF document · page count pending',
        })
        setPreviewUri(null)
        setRetryImage(null)
        setSavedNotice(false)
        setWorking(true)
        setMessage('PDF selected. Showing the local UI preview for this MVP.')
        await wait(700)
        if (!mounted.current) return
        applyExtractionResult(demoReportExtraction)
      } catch (error) {
        if (!mounted.current) return
        setMessage(
          error instanceof Error ? error.message : 'Could not open the PDF picker.'
        )
      } finally {
        if (mounted.current) setWorking(false)
      }
    })

  const showDemo = () =>
    runExclusive(async () => {
      setSelectedFile({
        name: 'sample-pathology-report.pdf',
        source: 'pdf',
        sizeLabel: '842 KB',
        detail: 'PDF document · 2 pages',
      })
      setPreviewUri(null)
      setRetryImage(null)
      setSavedNotice(false)
      setWorking(true)
      setMessage(null)
      await wait(450)
      if (!mounted.current) return
      applyExtractionResult(demoReportExtraction)
      setWorking(false)
    })

  const addManual = () => {
    setCandidates((items) =>
      addManualMetricCandidate(items, {
        name: 'New metric',
        value: 0,
        unit: '',
        referenceLow: null,
        referenceHigh: null,
      })
    )
    setMessage(
      'Manual metric added. Edit every field, then confirm it before saving.'
    )
  }

  const confirmAll = () => {
    setCandidates((items) =>
      items.map((candidate) => ({ ...candidate, confirmed: true }))
    )
  }

  const toggleCandidate = (localId: string) => {
    setCandidates((items) => toggleMetricCandidate(items, localId))
  }

  const changeCandidate = (
    localId: string,
    patch: {
      name: string
      value: number
      unit: string
      referenceLow: number | null
      referenceHigh: number | null
    }
  ) => {
    setCandidates((items) => editMetricCandidate(items, localId, patch))
  }

  const removeCandidate = (localId: string) => {
    setCandidates((items) => removeMetricCandidate(items, localId))
  }

  const saveConfirmed = () =>
    runExclusive(async () => {
      if (hasInvalidConfirmedCandidates(candidates)) {
        setMessage('Every confirmed metric needs a name and a valid numeric value.')
        return
      }
      const metrics = toConfirmedReportMetrics(candidates)
      if (metrics.length === 0) {
        setMessage('Confirm at least one valid metric before saving this report.')
        return
      }
      setWorking(true)
      try {
        await saveReport(metrics)
        if (!mounted.current) return
        setCandidates([])
        setPreviewUri(null)
        setSelectedFile(null)
        setSavedNotice(true)
        setMessage(null)
        await refreshReports()
      } catch (error) {
        if (!mounted.current) return
        setMessage(
          error instanceof Error
            ? error.message
            : 'Save failed. Your edits are still here.'
        )
      } finally {
        if (mounted.current) setWorking(false)
      }
    })

  const deleteSavedReport = async (reportId: string) => {
    try {
      await deleteReport(reportId)
      await refreshReports()
    } catch (error) {
      if (!mounted.current) return
      setListError(error instanceof Error ? error.message : 'Delete failed.')
    }
  }

  return {
    reports,
    loadingReports,
    listError,
    candidates,
    selectedFile,
    previewUri,
    retryImage,
    working,
    message,
    reportName,
    setReportName,
    reportDate,
    setReportDate,
    savedNotice,
    refreshReports,
    retryExtraction,
    openCamera,
    openLibrary,
    openPdf,
    showDemo,
    addManual,
    confirmAll,
    toggleCandidate,
    changeCandidate,
    removeCandidate,
    saveConfirmed,
    deleteSavedReport,
    getReportRecommendations,
    regenerateReportRecommendations,
  }
}

export interface TeacherCookieData {
  teacherId: string
  username: string
  fullName: string
  email: string
  phoneNumber: string
  gradeId: number
  subjectId: number
  section: string
  gradeName: string
  subjectName: string
  sections: string[]
  manageGradeId?: number
  manageSection?: string
  manageGradeName?: string
}

export async function getTeacherDataFromCookie(): Promise<TeacherCookieData | null> {
  try {
    // Get all cookies and find the teacher cookie
    const cookies = document.cookie.split(";")

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=")
      if (name === "teacherData" || name === "teacher_data") {
        const decoded = decodeURIComponent(value)
        const parsed = JSON.parse(decoded)
        return parsed as TeacherCookieData
      }
    }

    return null
  } catch (error) {
    console.error("Error reading teacher cookie:", error)
    return null
  }
}

export function setTeacherDataCookie(data: TeacherCookieData): void {
  try {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 7) // 7 days expiration

    const cookieValue = encodeURIComponent(JSON.stringify(data))
    document.cookie = `teacherData=${cookieValue}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`
  } catch (error) {
    console.error("Error setting teacher cookie:", error)
  }
}

export function clearTeacherDataCookie(): void {
  document.cookie = "teacherData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
}

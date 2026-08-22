/** 
 * Course actions — currently just "Add a missing course" (spec §5.5).
 *
 * This file stores the function that exported to add-course-dialog.tsx
 * where it is called when the user submits the "Add a Course" request.
 * As a result, this function redirects the user to gmail where they can then
 * review their request (this function transfers their filled out request into a neat email)
 * and then click send in gmail once ready.
 */

export type GmailComposeData = {
  department: string;
  course_number: string;
  course_name: string;
};

const DESTINATION_EMAIL = "goldysstudybuddies@gmail.com";

export async function openGmailCompose(data: GmailComposeData): Promise<void> {
  const subject = `ADD NEW COURSE REQUEST`;
  data.department = data.department.toUpperCase();
  if(data.course_name === ""){data.course_name = 'NOT PROVIDED';}
  const body = `DEPARTMENT:\n${data.department}\n\nCOURSE NUMBER:\n${data.course_number}\n\nCOURSE NAME (Optional):\n${data.course_name}`;

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: DESTINATION_EMAIL,
    su: subject,
    body: body,
  });

  const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;

  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}
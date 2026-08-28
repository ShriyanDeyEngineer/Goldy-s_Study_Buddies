/** This is the web page that display's our privacy policy for users */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Rules & Guidelines",
  description:
    "Guidelines that every user must follow in order to be able to use this website.",
};

const CONTACT_EMAIL = "goldysstudybuddies@gmail.com";

export default function CommunityRulesGuidelinesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 font-['Times_New_Roman']">
        <div className="mx-auto max-w-2xl">

            <h1 className="font-display text-4xl text-ink text-center">COMMUNITY RULES & GUIDELINES</h1>

            <br></br>
            <br></br>
            
            <h2 className="font-display text-2xl text-ink text-left"></h2>
                <p className="mt-4 text-ink-muted text-left"></p>


            
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 text-blue-500 text-left font-bold">
              {CONTACT_EMAIL}
            </a>
        
        </div>
    </div>
  );
}
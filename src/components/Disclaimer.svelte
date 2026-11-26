<script lang="ts">
  // Master-era footer text and draft disclaimer, plus (4a.5) the catalog details that the
  // Oct 19 "EPA workbook loaded" notice used to show.
  import { getApp } from '../lib/context';
  import { loadedNotice } from '../lib/currency';

  const app = getApp();
  const details = $derived(
    app.loadState === 'ready'
      ? loadedNotice(app.catalog, app.status, app.flags.usingEmbeddedSnapshot)
      : null,
  );
</script>

<footer class="disclaimer">
  {#if details}<p class="catalog-details" id="catalog-details">
      <strong>{details.title}.</strong>
      {details.message}
    </p>{/if}
  <p>
    <strong>Educational reference only.</strong> Data may be incomplete, inaccurate, or out of date. Verify
    the exact product, current label, federal and state registration, and applicable restrictions before
    use. EPA ingredient percentages are not application rates; check the source concentration basis. Inclusion
    is not an endorsement or an efficacy rating. This replacement candidate has not been reviewed or endorsed
    by CPN.
  </p>
  <details id="tool-disclaimer" class="guide-block">
    <summary>Draft disclaimer &amp; limitation of liability</summary>
    <div class="guide-copy">
      <p><strong>Proposed language — pending CPN legal review.</strong></p>
      <p>
        “What’s on Your Seed?” is an educational reference for identifying and comparing seed
        treatment products. It is not legal advice, a product recommendation, or authorization to
        purchase, sell, apply, plant, or otherwise use a pesticide or treated seed.
      </p>
      <p>
        Information is compiled from external sources and may contain errors, omissions, or outdated
        material. Registration status, labels, restrictions, product formulations, and availability
        can change after a source is published or retrieved. Displayed dates describe the identified
        records; they do not guarantee that every field is current. A missing record does not
        establish that a product is prohibited, and a listed product does not establish that a
        particular use is permitted. Third-party information and linked websites are outside CPN’s
        control.
      </p>
      <p>
        Before acting, users are responsible for independently confirming the exact product and full
        EPA registration number, current labeling and seed-tag instructions, federal and state
        registration status, and all applicable use restrictions and requirements with the
        appropriate regulatory authority and product manufacturer. Always read and follow current
        labeling. This tool does not replace those requirements or professional advice appropriate
        to the situation.
      </p>
      <p>
        To the fullest extent permitted by applicable law, the Crop Protection Network (CPN), its
        participating institutions, contributors, and data managers provide this tool and its
        information “as is” and “as available,” without express or implied warranties, including
        warranties of accuracy, completeness, timeliness, merchantability, or fitness for a
        particular purpose. To that same extent, they disclaim liability for losses, damages,
        claims, or expenses arising from use of, inability to use, or reliance on the tool,
        including errors, omissions, delayed updates, or inaccurate third-party information, and
        resulting crop injury, reduced yield, or economic loss. Nothing in this notice excludes or
        limits liability that cannot lawfully be excluded or limited.
      </p>
      <p>
        Reference to a product, manufacturer, or service does not constitute endorsement. Inclusion
        or omission is not a finding of safety, efficacy, suitability, or legal authorization.
      </p>
    </div>
  </details>
</footer>

<style>
  /* Printed views keep the disclaimer (the Oct 19 print CSS hid it). */
  @media print {
    .disclaimer {
      display: block !important;
    }
  }
</style>

  METHOD xngrxcds_ps_mast_update_entity.

    DATA: ls_payload   TYPE /ngr/cl_od_ps_tracker_mpc_ext=>ts_xngrxcds_ps_mastertype,
          lv_id        TYPE /ngr/t_master-id,
          ls_db_before TYPE /ngr/t_master,
          ls_db_after  TYPE /ngr/t_master.

    " 1. Read incoming payload
    io_data_provider->read_entry_data( IMPORTING es_data = ls_payload ).

    IF ls_payload-status = 'SUBMITTED' OR ls_payload-status = 'WIN' OR ls_payload-status = 'COMPLETE'.
      IF ls_payload-opptcv <= 0 OR ls_payload-currency IS INITIAL
         OR ( ( ls_payload-currency = 'USD' OR ls_payload-currency = 'EUR' )
              AND ls_payload-opptcv <= 1 ).
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING message = 'Opp. Size and currency are required; USD/EUR size must exceed 1'.
      ENDIF.
    ENDIF.
    IF ( ls_payload-status = 'WIN' OR ls_payload-status = 'COMPLETE' )
       AND ls_payload-closedate IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING message = 'Win/Loss Date is required for won opportunities'.
    ENDIF.

    "Validation
    IF ls_payload-status = 'DELE'.
      AUTHORITY-CHECK OBJECT '/NGR/PST_A' ID 'ACTVT' FIELD '02'.
      IF sy-subrc NE 0.
        RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
          EXPORTING
            message = |User does not have authorization to delete opportunity|.
      ELSE.
        ls_payload-deletionindicator = abap_true.
      ENDIF.
    ENDIF.

    " 2. Extract and validate key
    lv_id = ls_payload-id.
    IF lv_id IS INITIAL.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = 'Opportunity ID is mandatory'.
    ENDIF.

    " 3. Read current DB entry
    SELECT SINGLE * INTO ls_db_before FROM /ngr/t_master WHERE id = lv_id.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = |Opportunity with ID { lv_id } not found|.
    ENDIF.

    " 4. Prepare new version for update
    " ls_db_after starts as a copy of the DB row, so columns not assigned below
    " (e.g. the retired free-text PROPOSAL_TYPE) keep their stored values.
    ls_db_after = ls_db_before.

    ls_db_after-customer_name         = ls_payload-customername.
    ls_db_after-customer_desc         = ls_payload-customerdesc.
    ls_db_after-opp_desc              = ls_payload-oppdesc.
    ls_db_after-geography             = ls_payload-geography.
    ls_db_after-line_of_business      = ls_payload-lineofbusiness.
    ls_db_after-solution_area         = ls_payload-solutionarea.
    ls_db_after-country               = ls_payload-country.
    ls_db_after-deal_type             = ls_payload-dealtype.
    ls_db_after-opp_type              = ls_payload-opptype.
    ls_db_after-received_date         = ls_payload-receiveddate.
    ls_db_after-submission_date       = COND #( WHEN ls_payload-status EQ 'WIP' THEN ls_db_before-submission_date ELSE ls_payload-submissiondate ).
    ls_db_after-status                = ls_payload-status.
    ls_db_after-opp_tcv               = ls_payload-opptcv.
    ls_db_after-currency              = ls_payload-currency.
    ls_db_after-comm_model            = ls_payload-commmodel.
    ls_db_after-close_date            = ls_payload-closedate.
    ls_db_after-probability           = ls_payload-probability.
    ls_db_after-doc_url               = ls_payload-docurl.
    ls_db_after-commercial_url        = ls_payload-commercialurl.
    ls_db_after-planned_subm_date     = ls_payload-plannedsubmissiondate.
    ls_db_after-reviewed_by_pr        = ls_payload-practicereviewwer.
    ls_db_after-reviewed_by_ps        = ls_payload-presalesreviewwer.
    ls_db_after-resource_fut_dmd      = ls_payload-resourcefuturedemandupdated.
    ls_db_after-sap_system            = ls_payload-sapsystem.
    ls_db_after-sap_system_category   = ls_payload-sapsystemcategory.
    ls_db_after-opp_category          = ls_payload-opportunitytype.
    ls_db_after-delivery_handover     = ls_payload-deliveryhandover.
    ls_db_after-opp_type_ot           = COND #( WHEN ls_payload-opptype EQ 'OTR' THEN ls_payload-opptypeother ELSE '' ).
    ls_db_after-line_of_business_ot   = COND #( WHEN ls_payload-lineofbusiness EQ 'OTHR' THEN ls_payload-lineofbusinessother ELSE '' ).
    ls_db_after-next_followup_date    = ls_payload-nextfollowupdate.
    ls_db_after-due_submission_date   = ls_payload-duesubmissiondate.
    ls_db_after-reason                = COND #(
                                            " From LOSS -> Something else then clear it out
                                            WHEN ls_payload-status NE 'LOSS' AND ls_db_before-status EQ 'LOSS' THEN ''
                                            " Otherwise retain the data received
                                            ELSE ls_payload-reason
                                            ).
    ls_db_after-close_remaks          = COND #(
                                            " From CLSD -> Something else then clear it out
                                            WHEN ls_payload-status NE 'CLSD' AND ls_db_before-status EQ 'CLSD' THEN ''
                                            " From NOGO -> Something else then clear it out
                                            WHEN ls_payload-status NE 'NOGO' AND ls_db_before-status EQ 'NOGO' THEN ''
                                            " Otherwise retain the data received
                                            ELSE ls_payload-closeremarks
                                            ).
    ls_db_after-bu_details            = ls_payload-budetails.
    ls_db_after-complexity            = ls_payload-complexity.
    ls_db_after-win_chance            = ls_payload-winchance.
    ls_db_after-proposal_type_op      = ls_payload-proposaltypeop.

    ls_db_after-updated_by            = sy-uname.
    ls_db_after-updated_on            = sy-datum.
    ls_db_after-updated_at            = sy-uzeit.

    " 5. Update database
    UPDATE /ngr/t_master FROM ls_db_after.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE /iwbep/cx_mgw_busi_exception
        EXPORTING
          message = |Failed to update opportunity { lv_id }|.
    ELSE.
      IF ls_db_before-status <> ls_db_after-status.

        " Get next RM_ITEM for the given ID
        SELECT MAX( rm_item ) INTO @DATA(lv_new_item)
          FROM /ngr/t_remarks
          WHERE id = @lv_id.
        IF sy-subrc NE 0.
          lv_new_item = 0.
        ENDIF.
        lv_new_item = lv_new_item + 1.

        DATA(ls_remark) = VALUE /ngr/t_remarks(
                                id         = lv_id
                                created_by = sy-uname
                                created_on = sy-datum
                                created_at = sy-uzeit
                                rm_item    = lv_new_item
                                rm_text    = |Status changed from { ls_db_before-status } to { ls_db_after-status }.|
        ).

        INSERT /ngr/t_remarks FROM ls_remark.
      ENDIF.

      IF ls_db_before-planned_subm_date <> ls_db_after-planned_subm_date.
        CLEAR lv_new_item.
        " Get next RM_ITEM for the given ID
        SELECT MAX( rm_item ) INTO @lv_new_item
          FROM /ngr/t_remarks
          WHERE id = @lv_id.
        IF sy-subrc NE 0.
          lv_new_item = 0.
        ENDIF.
        lv_new_item = lv_new_item + 1.
        CLEAR ls_remark.
        ls_remark = VALUE /ngr/t_remarks(
                                id         = lv_id
                                created_by = sy-uname
                                created_on = sy-datum
                                created_at = sy-uzeit
                                rm_item    = lv_new_item
                                rm_text    = |Planned Submission Date changed from { ls_db_before-planned_subm_date DATE = ENVIRONMENT } to { ls_db_after-planned_subm_date DATE = ENVIRONMENT }.|
        ).

        INSERT /ngr/t_remarks FROM ls_remark.
      ENDIF.
      IF ls_db_before-due_submission_date <> ls_db_after-due_submission_date.
        CLEAR lv_new_item.
        " Get next RM_ITEM for the given ID
        SELECT MAX( rm_item ) INTO @lv_new_item
          FROM /ngr/t_remarks
          WHERE id = @lv_id.
        IF sy-subrc NE 0.
          lv_new_item = 0.
        ENDIF.
        lv_new_item = lv_new_item + 1.
        CLEAR ls_remark.
        ls_remark = VALUE /ngr/t_remarks(
                                id         = lv_id
                                created_by = sy-uname
                                created_on = sy-datum
                                created_at = sy-uzeit
                                rm_item    = lv_new_item
                                rm_text    = |Due Submission Date changed from { ls_db_before-due_submission_date DATE = ENVIRONMENT } to { ls_db_after-due_submission_date DATE = ENVIRONMENT }.|
        ).

        INSERT /ngr/t_remarks FROM ls_remark.
      ENDIF.
      TRY.
          /ngr/cl_cdo_ps_mas_chdo=>write(
            EXPORTING
              objectid                = CONV #( lv_id )
              tcode                   = sy-tcode
              utime                   = sy-uzeit
              udate                   = sy-datum
              username                = sy-uname
              object_change_indicator = 'U'
              o_ngr_t_master          = ls_db_before
              n_ngr_t_master          = ls_db_after
              upd_ngr_t_master        = 'U'
          ).
        CATCH cx_chdo_write_error INTO DATA(lx_cd_error).
          MESSAGE lx_cd_error->get_text( ) TYPE 'E'.
      ENDTRY.
    ENDIF.

    er_entity = CORRESPONDING #( ls_db_after ).

  ENDMETHOD.
